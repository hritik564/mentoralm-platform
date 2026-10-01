import 'server-only';
import { learningEvent } from './events';
import { randomBytes } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { outlineSelect, projectCourse } from './course-projection';
import { attendanceProjection } from './attendance';
import { entitledStudentWhere } from './entitlement';
export function finalizeCourseProjection(
  course: ReturnType<typeof projectCourse>,
  attendance: Awaited<ReturnType<typeof attendanceProjection>>,
) {
  const attendanceMet =
    course.requiredAttendancePercent === null ||
    (attendance.total > attendance.excused &&
      (attendance.present + attendance.late) * 100 >=
        course.requiredAttendancePercent *
          (attendance.total - attendance.excused));
  const eligible =
    course.academicCompletionEnabled &&
    course.progress.requiredItems > 0 &&
    course.progress.completedItems === course.progress.requiredItems &&
    attendanceMet;
  return {
    ...course,
    completion: {
      eligible,
      attendanceMet,
      attendancePercent: attendance.percentage,
      certificateEligible: eligible && course.certificateEnabled,
    },
  };
}
export async function evaluateCompletion(
  db: Prisma.TransactionClient,
  userId: string,
  courseId: string,
) {
  const record = await db.course.findFirst({
    where: {
      id: courseId,
      published: true,
      enrollments: { some: { userId, user: entitledStudentWhere(userId) } },
    },
    select: outlineSelect(userId),
  });
  if (!record) return;
  const projected = finalizeCourseProjection(
    projectCourse(record),
    await attendanceProjection(db, userId, record),
  );
  if (!record.academicCompletionEnabled) return;
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { userId_courseId: { userId, courseId } },
  });
  if (projected.completion.eligible) {
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: 'COMPLETED',
        completedAt: enrollment.completedAt || new Date(),
      },
    });
    await learningEvent(db, {
      kind: 'CourseCompleted',
      key: `course-completed:${enrollment.id}`,
      subjectId: enrollment.id,
      courseId,
      userId,
    });
  } else if (enrollment.status === 'COMPLETED')
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'IN_PROGRESS' },
    });
  const certificate = await db.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (projected.completion.certificateEligible) {
    if (!certificate) {
      const issued = await db.certificate.create({
        data: {
          userId,
          courseId,
          code: `MLM-${randomBytes(18).toString('hex').toUpperCase()}`,
        },
      });
      await learningEvent(db, {
        kind: 'CertificateIssued',
        key: `certificate-issued:${issued.id}`,
        subjectId: issued.id,
        courseId,
        userId,
      });
    } else if (certificate.status === 'SUSPENDED')
      await db.certificate.update({
        where: { id: certificate.id },
        data: { status: 'ACTIVE' },
      });
  } else if (certificate?.status === 'ACTIVE')
    await db.certificate.update({
      where: { id: certificate.id },
      data: { status: 'SUSPENDED' },
    });
}
export async function academicTransaction<T>(
  db: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let i = 0; i < 12; i++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['P2034', 'P2002'].includes(String(error.code)) &&
        i < 11
      )
        continue;
      throw error;
    }
  }
  throw Error('Transaction unavailable');
}
