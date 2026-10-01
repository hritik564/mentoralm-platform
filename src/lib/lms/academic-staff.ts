import 'server-only';
import type {
  Prisma,
  PrismaClient,
  SubmissionStatus,
  AttendanceStatus,
} from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { academicTransaction, evaluateCompletion } from './completion';
export class AcademicStaff {
  constructor(
    private db: PrismaClient,
    private actorId: string,
  ) {}
  private async authorize(
    db: Prisma.TransactionClient,
    batchId: string | undefined,
    course: { id: string; programId: string | null },
  ) {
    const actor = await db.user.findUnique({
      where: { id: this.actorId },
      select: { role: true },
    });
    if (actor?.role === 'ADMIN') return;
    if (actor?.role !== 'INSTRUCTOR' || !batchId)
      throw new StudentError('FORBIDDEN');
    const batch = await db.batch.findFirst({
      where: {
        id: batchId,
        instructors: { some: { instructorId: this.actorId } },
      },
      select: { courseId: true, programId: true },
    });
    if (
      !batch ||
      !(
        batch.courseId === course.id ||
        (!!course.programId && batch.programId === course.programId)
      )
    )
      throw new StudentError('FORBIDDEN');
  }
  async review(
    versionId: string,
    status: SubmissionStatus,
    feedback: string,
    batchId?: string,
  ) {
    if (
      !['UNDER_REVIEW', 'CHANGES_REQUESTED', 'ACCEPTED'].includes(status) ||
      !feedback.trim() ||
      feedback.length > 12000
    )
      throw new StudentError('INVALID_INPUT');
    return academicTransaction(this.db, async (db) => {
      const version = await db.submissionVersion.findUnique({
        where: { id: versionId },
        include: {
          submission: {
            include: {
              assignment: {
                include: {
                  item: { include: { section: { include: { course: true } } } },
                },
              },
            },
          },
        },
      });
      if (!version) throw new StudentError('NOT_FOUND');
      const { submission: s } = version,
        course = s.assignment.item.section.course;
      await this.authorize(db, batchId, course);
      if (
        batchId &&
        !(await db.batchMembership.findFirst({
          where: {
            batchId,
            userId: s.userId,
            status: 'ACTIVE',
            joinedAt: { lte: new Date() },
            OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
          },
        }))
      )
        throw new StudentError('FORBIDDEN');
      const latest = await db.submissionVersion.findFirst({
        where: { submissionId: s.id },
        orderBy: { number: 'desc' },
      });
      if (latest?.id !== version.id) throw new StudentError('FORBIDDEN');
      await db.assignmentReview.create({
        data: {
          versionId,
          reviewerId: this.actorId,
          status,
          feedback: feedback.trim(),
        },
      });
      await db.submissionVersion.update({
        where: { id: versionId },
        data: { status },
      });
      await db.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: 'ASSIGNMENT_REVIEW',
          targetId: versionId,
        },
      });
      await evaluateCompletion(db, s.userId, course.id);
    });
  }
  async attendance(
    sessionId: string,
    membershipId: string,
    status: AttendanceStatus,
  ) {
    if (!['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status))
      throw new StudentError('INVALID_INPUT');
    return academicTransaction(this.db, async (db) => {
      const session = await db.batchSession.findUnique({
        where: { id: sessionId },
        include: {
          batch: true,
          course: true,
          item: { include: { section: { include: { course: true } } } },
        },
      });
      const member = await db.batchMembership.findUnique({
        where: { id: membershipId },
      });
      if (
        !session ||
        !member ||
        session.status !== 'HELD' ||
        (session.batch.startsAt && session.startsAt < session.batch.startsAt) ||
        (session.batch.endsAt && session.startsAt > session.batch.endsAt) ||
        member.batchId !== session.batchId ||
        member.joinedAt > session.startsAt ||
        (member.leftAt && member.leftAt <= session.startsAt)
      )
        throw new StudentError('FORBIDDEN');
      const course =
        session.course ||
        session.item?.section.course ||
        (session.batch.courseId
          ? await db.course.findUnique({
              where: { id: session.batch.courseId },
            })
          : null);
      if (
        session.item &&
        (session.item.type !== 'LIVE_SESSION' ||
          (session.courseId &&
            session.courseId !== session.item.section.courseId))
      )
        throw new StudentError('FORBIDDEN');
      const actor = await db.user.findUnique({
        where: { id: this.actorId },
        select: { role: true },
      });
      if (actor?.role !== 'ADMIN') {
        if (!course) {
          if (
            actor?.role !== 'INSTRUCTOR' ||
            !(await db.batchInstructor.findUnique({
              where: {
                batchId_instructorId: {
                  batchId: session.batchId,
                  instructorId: this.actorId,
                },
              },
            }))
          )
            throw new StudentError('FORBIDDEN');
        } else await this.authorize(db, session.batchId, course);
      }
      if (
        course &&
        !(
          (!session.batch.courseId && !session.batch.programId) ||
          session.batch.courseId === course.id ||
          (course.programId && session.batch.programId === course.programId)
        )
      )
        throw new StudentError('FORBIDDEN');
      const prior = await db.attendanceRecord.findUnique({
        where: { sessionId_userId: { sessionId, userId: member.userId } },
        select: { status: true },
      });
      await db.attendanceRecord.upsert({
        where: { sessionId_userId: { sessionId, userId: member.userId } },
        create: { sessionId, userId: member.userId, membershipId, status },
        update: { status, recordedAt: new Date() },
      });
      await db.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: `ATTENDANCE_${prior?.status || 'UNRECORDED'}_TO_${status}`,
          targetId: sessionId,
        },
      });
      if (course) await evaluateCompletion(db, member.userId, course.id);
    });
  }
  /** Future publication/policy changes invoke reconciliation through this scoped, audited boundary. */
  async reconcile(userId: string, courseId: string, batchId?: string) {
    return academicTransaction(this.db, async (db) => {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { id: true, programId: true },
      });
      if (!course) throw new StudentError('NOT_FOUND');
      await this.authorize(db, batchId, course);
      if (
        batchId &&
        !(await db.batchMembership.findFirst({
          where: { batchId, userId, status: 'ACTIVE' },
        }))
      )
        throw new StudentError('FORBIDDEN');
      await evaluateCompletion(db, userId, courseId);
      await db.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: 'COURSE_RECONCILE',
          targetId: courseId,
        },
      });
    });
  }
  async revokeCertificate(code: string) {
    return academicTransaction(this.db, async (db) => {
      if (
        (
          await db.user.findUnique({
            where: { id: this.actorId },
            select: { role: true },
          })
        )?.role !== 'ADMIN'
      )
        throw new StudentError('FORBIDDEN');
      const c = await db.certificate.findUnique({ where: { code } });
      if (!c) throw new StudentError('NOT_FOUND');
      await db.certificate.update({
        where: { id: c.id },
        data: { status: 'REVOKED' },
      });
      await db.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: 'CERTIFICATE_REVOKE',
          targetId: c.id,
        },
      });
    });
  }
}
