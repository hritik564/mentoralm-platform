import 'server-only';
import type { PrismaClient } from '../../generated/prisma/client';
import { adminCapabilities } from '../auth/admin-policy';
import { entitledStudentWhere } from '../lms/entitlement';
import { safeAuditAction } from './governance/audit-projection';
import { adminHandle } from './handles';

/** Read-only dashboard projection. Each domain query requires its existing capability. */
export async function readAdminDashboard(
  db: PrismaClient,
  actorId: string,
  now = new Date(),
) {
  const capabilities = await adminCapabilities(db, actorId),
    allowed = (permission: (typeof capabilities.permissions)[number]) =>
      capabilities.permissions.includes(permission),
    students = allowed('STUDENTS_MANAGE'),
    batches = allowed('BATCHES_MANAGE'),
    academics = allowed('ACADEMICS_MANAGE'),
    support = allowed('SUPPORT_MANAGE'),
    audit = allowed('AUDIT_VIEW');
  const date = now.toISOString().slice(0, 10),
    start = new Date(`${date}T00:00:00.000Z`),
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const [
    registered,
    enabled,
    active,
    enrollments,
    courses,
    tickets,
    events,
    sessions,
    recordings,
    readyRecordings,
    todaySessions,
    learningCourses,
  ] = await Promise.all([
    students ? db.user.count({ where: { role: 'STUDENT' } }) : -1,
    students
      ? db.user.count({
          where: { ...entitledStudentWhere(''), id: undefined },
        })
      : -1,
    batches ? db.batch.count({ where: { status: 'ACTIVE' } }) : -1,
    students
      ? db.enrollment.count({
          where: { status: { in: ['ENROLLED', 'IN_PROGRESS'] } },
        })
      : -1,
    academics ? db.course.count({ where: { published: true } }) : -1,
    support
      ? db.supportTicket.count({
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        })
      : -1,
    audit
      ? db.academicAudit.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { action: true, createdAt: true },
        })
      : [],
    batches ? db.batchSession.count({ where: { status: 'SCHEDULED' } }) : -1,
    batches
      ? db.batchSessionRecording.count({
          where: { status: 'PUBLISHED', cleanupRequestedAt: null },
        })
      : -1,
    batches
      ? db.batchSessionRecording.count({
          where: { status: 'READY', cleanupRequestedAt: null },
        })
      : -1,
    batches
      ? db.batchSession.findMany({
          where: {
            status: 'SCHEDULED',
            startsAt: { gte: start, lt: end },
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            status: true,
            batch: { select: { id: true, name: true } },
          },
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          take: 5,
        })
      : [],
    academics
      ? db.course.findMany({
          select: {
            id: true,
            title: true,
            published: true,
            program: { select: { title: true } },
            _count: { select: { enrollments: true } },
          },
          orderBy: { id: 'asc' },
          take: 5,
        })
      : [],
  ]);
  const metrics: Record<string, number> = Object.fromEntries(
    Object.entries({
      students: registered,
      enabled,
      batches: active,
      enrollments,
      courses,
      support: tickets,
      sessions,
      recordings,
    }).filter(([, value]) => value >= 0),
  );
  return {
    metrics,
    events: events.map((event) => ({
      action: safeAuditAction(event.action),
      at: event.createdAt.toISOString(),
    })),
    ...(batches
      ? {
          readyRecordings,
          todaySessions: {
            timeZone: 'UTC' as const,
            date,
            rows: todaySessions.map((session) => ({
              ref: adminHandle('session', session.id),
              title: session.title,
              startsAt: session.startsAt.toISOString(),
              endsAt: session.endsAt.toISOString(),
              status: session.status,
              batchRef: adminHandle('batch', session.batch.id),
              batchName: session.batch.name,
            })),
          },
        }
      : {}),
    ...(academics
      ? {
          learningCourses: learningCourses.map((course) => ({
            courseRef: adminHandle('course', course.id),
            title: course.title,
            program: course.program?.title || 'Independent',
            published: course.published,
            enrollments: course._count.enrollments,
          })),
        }
      : {}),
  };
}
