import 'server-only';
import { entitledStudentWhere } from './entitlement';
import type { Prisma } from '../../generated/prisma/client';
export async function attendanceMemberships(
  db: Prisma.TransactionClient,
  userId: string,
) {
  return await db.batchMembership.findMany({
    where: {
      userId,
      batch: {
        OR: [
          { courseId: null },
          {
            course: {
              published: true,
              enrollments: {
                some: { userId, user: entitledStudentWhere(userId) },
              },
            },
          },
        ],
      },
    },
    select: {
      id: true,
      joinedAt: true,
      leftAt: true,
      batch: {
        select: {
          name: true,
          startsAt: true,
          endsAt: true,
          courseId: true,
          programId: true,
          sessions: {
            where: {
              status: 'HELD',
              OR: [
                { courseId: null },
                {
                  course: {
                    published: true,
                    enrollments: {
                      some: { userId, user: entitledStudentWhere(userId) },
                    },
                  },
                },
              ],
            },
            orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
            select: {
              id: true,
              title: true,
              startsAt: true,
              endsAt: true,
              courseId: true,
              attendance: {
                where: { userId },
                select: { status: true, recordedAt: true },
              },
            },
          },
        },
      },
    },
  });
}
export function projectAttendance(
  memberships: Awaited<ReturnType<typeof attendanceMemberships>>,
  course?: { id: string; programId: string | null },
) {
  const sessions = memberships
    .flatMap((m) =>
      m.batch.sessions
        .filter(
          (s) =>
            s.startsAt >= m.joinedAt &&
            (!m.batch.startsAt || s.startsAt >= m.batch.startsAt) &&
            (!m.batch.endsAt || s.startsAt <= m.batch.endsAt) &&
            (!m.leftAt || s.startsAt < m.leftAt) &&
            (!course ||
              s.courseId === course.id ||
              (!s.courseId &&
                (m.batch.courseId === course.id ||
                  (!!course.programId &&
                    m.batch.programId === course.programId)))),
        )
        .map((s) => ({
          id: s.id,
          title: s.title,
          batch: m.batch.name,
          startsAt: s.startsAt.toISOString(),
          status: s.attendance[0]?.status || 'UNRECORDED',
        })),
    )
    .sort(
      (a, b) =>
        b.startsAt.localeCompare(a.startsAt) || a.id.localeCompare(b.id),
    );
  const count = (status: string) =>
    sessions.filter((s) => s.status === status).length;
  const denominator = sessions.length - count('EXCUSED');
  return {
    sessions,
    total: sessions.length,
    present: count('PRESENT'),
    late: count('LATE'),
    absent: count('ABSENT'),
    excused: count('EXCUSED'),
    unrecorded: count('UNRECORDED'),
    percentage: denominator
      ? Math.round(((count('PRESENT') + count('LATE')) / denominator) * 1000) /
        10
      : null,
  };
}

export async function attendanceProjection(
  db: Prisma.TransactionClient,
  userId: string,
  course?: { id: string; programId: string | null },
) {
  return projectAttendance(await attendanceMemberships(db, userId), course);
}
