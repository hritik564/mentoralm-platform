import 'server-only';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { entitledStudentWhere } from '../lms/entitlement';
import { currentBatch } from '../lms/batches';
import { AdminOperations } from './operations';
import { adminHandle as handle } from './handles';
import type { Directory } from './directory';
const studentSelect = {
  id: true,
  clerkUserId: true,
  studentId: true,
  createdAt: true,
  lmsAccessOverride: true,
  memberships: {
    include: { batch: true },
    take: 100,
    orderBy: { joinedAt: 'desc' as const },
  },
  _count: { select: { enrollments: true } },
} satisfies Prisma.UserSelect;
function params(input: Record<string, string | undefined>) {
  const page = Number(input.page || '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw new StudentError('INVALID_INPUT');
  const q = (input.q || '').trim();
  if (q.length > 100) throw new StudentError('INVALID_INPUT');
  return { page, q, take: 20, skip: (page - 1) * 20 };
}
export class AdminRepository extends AdminOperations {
  constructor(
    db: PrismaClient,
    actorId: string,
    private directory: Directory,
  ) {
    super(db, actorId);
  }
  async overview() {
    await this.authorize();
    const [students, enabled, batches, enrollments, courses, support, events] =
      await Promise.all([
        this.db.user.count({ where: { role: 'STUDENT' } }),
        this.db.user.count({
          where: { ...entitledStudentWhere(''), id: undefined },
        }),
        this.db.batch.count({ where: { status: 'ACTIVE' } }),
        this.db.enrollment.count({
          where: { status: { in: ['ENROLLED', 'IN_PROGRESS'] } },
        }),
        this.db.course.count({ where: { published: true } }),
        this.db.supportTicket.count({
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        }),
        this.db.academicAudit.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { action: true, createdAt: true },
        }),
      ]);
    return {
      metrics: { students, enabled, batches, enrollments, courses, support },
      events: events.map((e) => ({
        action: e.action.replaceAll('_', ' '),
        at: e.createdAt.toISOString(),
      })),
    };
  }
  async students(input: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = params(input),
      ids = p.q ? await this.directory.search(p.q) : [];
    const where: Prisma.UserWhereInput = {
      role: 'STUDENT',
      ...(p.q
        ? {
            OR: [
              { studentId: { contains: p.q, mode: 'insensitive' } },
              { clerkUserId: { in: ids } },
            ],
          }
        : {}),
      ...(input.access === 'enabled'
        ? { AND: [{ ...entitledStudentWhere(''), id: undefined }] }
        : input.access === 'disabled'
          ? { NOT: { ...entitledStudentWhere(''), id: undefined } }
          : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.user.findMany({
        where,
        select: studentSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: p.take,
        skip: p.skip,
      }),
      this.db.user.count({ where }),
    ]);
    const identities = await this.directory.lookup(
      rows.map((r) => r.clerkUserId),
    );
    return {
      page: p.page,
      total,
      rows: await Promise.all(
        rows.map(async (r) => {
          const access = await this.effective(r.id);
          return {
            ref: handle('student', r.id),
            studentId: r.studentId,
            identity: identities.get(r.clerkUserId) || {
              name: 'Identity unavailable',
              email: '',
              phone: null,
              status: 'Unavailable',
            },
            joined: r.createdAt.toISOString(),
            batch:
              currentBatch(
                r.memberships
                  .filter(
                    (m) =>
                      m.joinedAt <= new Date() &&
                      (!m.leftAt || m.leftAt > new Date()),
                  )
                  .map((m) => ({
                    name: m.batch.name,
                    code: m.batch.code,
                    status: m.batch.status,
                    membershipStatus: m.status,
                    startsAt: m.batch.startsAt?.toISOString() || null,
                    endsAt: m.batch.endsAt?.toISOString() || null,
                    scope: null,
                    instructors: 0,
                  })),
              )?.name || '—',
            access: access.enabled,
            source: access.source,
            enrollments: r._count.enrollments,
          };
        }),
      ),
    };
  }
  async effective(userId: string) {
    await this.authorize();
    const user = await this.db.user.findFirst({
      where: { id: userId, role: 'STUDENT' },
      select: { lmsAccessOverride: true },
    });
    if (!user) throw new StudentError('NOT_FOUND');
    if (user.lmsAccessOverride)
      return {
        enabled: user.lmsAccessOverride === 'ENABLED',
        source:
          user.lmsAccessOverride === 'ENABLED'
            ? 'Individual override enables LMS access'
            : 'Individual override disables LMS access',
      };
    const where = entitledStudentWhere(userId),
      enabled = !!(await this.db.user.findFirst({
        where,
        select: { id: true },
      }));
    const now = new Date();
    const batch = enabled
      ? await this.db.batchMembership.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            joinedAt: { lte: now },
            OR: [{ leftAt: null }, { leftAt: { gt: now } }],
            batch: {
              status: 'ACTIVE',
              lmsAccessEnabled: true,
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
              ],
            },
          },
          include: { batch: true },
          orderBy: { joinedAt: 'desc' },
        })
      : null;
    return {
      enabled,
      source: batch
        ? `${batch.batch.name} Batch access`
        : 'No eligible Batch access',
    };
  }
  async student(id: string) {
    await this.authorize();
    const r = await this.db.user.findFirst({
      where: { id, role: 'STUDENT' },
      include: {
        profile: true,
        _count: { select: { enrollments: true, memberships: true } },
        enrollments: {
          include: { course: true },
          take: 100,
          orderBy: { enrolledAt: 'desc' },
        },
        memberships: {
          include: { batch: true },
          take: 100,
          orderBy: { joinedAt: 'desc' },
        },
      },
    });
    if (!r) throw new StudentError('NOT_FOUND');
    const identity = (await this.directory.lookup([r.clerkUserId])).get(
      r.clerkUserId,
    );
    return {
      ref: handle('student', id),
      studentId: r.studentId,
      identity: identity || {
        name: 'Identity unavailable',
        email: '',
        phone: null,
        status: 'Unavailable',
      },
      created: r.createdAt.toISOString(),
      counts: r._count,
      currentBatch:
        currentBatch(
          r.memberships
            .filter(
              (m) =>
                m.joinedAt <= new Date() &&
                (!m.leftAt || m.leftAt > new Date()),
            )
            .map((m) => ({
              name: m.batch.name,
              code: m.batch.code,
              status: m.batch.status,
              membershipStatus: m.status,
              startsAt: m.batch.startsAt?.toISOString() || null,
              endsAt: m.batch.endsAt?.toISOString() || null,
              scope: null,
              instructors: 0,
            })),
        )?.name || null,
      profile: r.profile
        ? {
            educationLevel: r.profile.educationLevel,
            institution: r.profile.institution,
            graduationYear: r.profile.graduationYear,
            interests: r.profile.interests,
            careerGoals: r.profile.careerGoals,
          }
        : null,
      override: r.lmsAccessOverride || 'INHERIT',
      effective: await this.effective(id),
      enrollments: r.enrollments.map((e) => ({
        courseRef: handle('course', e.courseId),
        title: e.course.title,
        status: e.status,
        joined: e.enrolledAt.toISOString(),
      })),
      memberships: r.memberships.map((m) => ({
        batchRef: handle('batch', m.batchId),
        name: m.batch.name,
        status: m.status,
        joined: m.joinedAt.toISOString(),
        left: m.leftAt?.toISOString() || null,
        batchAccess: m.batch.lmsAccessEnabled,
      })),
      audit: (
        await this.db.academicAudit.findMany({
          where: {
            OR: [{ targetId: id }, { targetId: { startsWith: `${id}:` } }],
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { action: true, createdAt: true },
        })
      ).map((e) => ({
        action: e.action.replaceAll('_', ' '),
        at: e.createdAt.toISOString(),
      })),
    };
  }
  async batches(input: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = params(input);
    if (
      input.status &&
      !['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].includes(input.status)
    )
      throw new StudentError('INVALID_INPUT');
    const where: Prisma.BatchWhereInput = {
      ...(p.q
        ? {
            OR: [
              { name: { contains: p.q, mode: 'insensitive' } },
              { code: { contains: p.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(input.status ? { status: input.status as 'ACTIVE' } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.batch.findMany({
        where,
        include: {
          program: true,
          course: true,
          _count: { select: { memberships: true, instructors: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: p.take,
        skip: p.skip,
      }),
      this.db.batch.count({ where }),
    ]);
    return {
      page: p.page,
      total,
      rows: rows.map((b) => ({
        ref: handle('batch', b.id),
        code: b.code,
        name: b.name,
        status: b.status,
        scope: b.course?.title || b.program?.title || 'Unscoped',
        starts: b.startsAt?.toISOString() || null,
        ends: b.endsAt?.toISOString() || null,
        access: b.lmsAccessEnabled,
        students: b._count.memberships,
        instructors: b._count.instructors,
      })),
    };
  }
  async batch(id: string, input: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = params(input);
    const b = await this.db.batch.findUnique({
      where: { id },
      include: {
        course: true,
        program: true,
        _count: { select: { memberships: true, instructors: true } },
        instructors: {
          include: { instructor: { select: { id: true, clerkUserId: true } } },
          take: 100,
        },
        sessions: {
          include: {
            instructor: { select: { clerkUserId: true } },
            item: { select: { title: true } },
            recording: true,
          },
          orderBy: { startsAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!b) throw new StudentError('NOT_FOUND');
    const [members, memberTotal] = await Promise.all([
      this.db.batchMembership.findMany({
        where: { batchId: id },
        include: {
          student: { select: { id: true, clerkUserId: true, studentId: true } },
        },
        orderBy: { joinedAt: 'desc' },
        skip: p.skip,
        take: p.take,
      }),
      this.db.batchMembership.count({ where: { batchId: id } }),
    ]);
    const ids = [
      ...new Set([
        ...members.map((m) => m.student.clerkUserId),
        ...b.instructors.map((i) => i.instructor.clerkUserId),
        ...b.sessions.flatMap((s) =>
          s.instructor ? [s.instructor.clerkUserId] : [],
        ),
      ]),
    ];
    const directory = await this.directory.lookup(ids.slice(0, 100));
    return {
      ref: handle('batch', id),
      code: b.code,
      name: b.name,
      status: b.status,
      courseRef: b.courseId ? handle('course', b.courseId) : null,
      programRef: b.programId ? handle('program', b.programId) : null,
      scope: b.course?.title || b.program?.title || 'Unscoped',
      starts: b.startsAt?.toISOString() || null,
      ends: b.endsAt?.toISOString() || null,
      access: b.lmsAccessEnabled,
      counts: {
        students: b._count.memberships,
        instructors: b._count.instructors,
      },
      page: p.page,
      total: memberTotal,
      members: await Promise.all(
        members.map(async (m) => ({
          ref: handle('student', m.userId),
          name:
            directory.get(m.student.clerkUserId)?.name ||
            'Identity unavailable',
          studentId: m.student.studentId,
          status: m.status,
          joined: m.joinedAt.toISOString(),
          left: m.leftAt?.toISOString() || null,
          effective: await this.effective(m.userId),
        })),
      ),
      instructors: b.instructors.map((i) => ({
        ref: handle('instructor', i.instructorId),
        name:
          directory.get(i.instructor.clerkUserId)?.name ||
          'Identity unavailable',
        assigned: i.assignedAt.toISOString(),
      })),
      sessions: b.sessions.map((s) => ({
        ref: handle('session', s.id),
        title: s.title,
        status: s.status,
        starts: s.startsAt.toISOString(),
        ends: s.endsAt.toISOString(),
        courseRef: s.courseId ? handle('course', s.courseId) : null,
        itemRef: s.itemId ? handle('item', s.itemId) : null,
        itemTitle: s.item?.title || null,
        instructorRef: s.instructorId
          ? handle('instructor', s.instructorId)
          : null,
        instructorName: s.instructor
          ? directory.get(s.instructor.clerkUserId)?.name ||
            'Identity unavailable'
          : null,
        location: s.locationLabel,
        externalTargetId: s.externalTargetId,
        recording: s.recording
          ? {
              revision: s.recording.revision,
              status: s.recording.status,
              title: s.recording.title,
              description: s.recording.description,
              readyAt: s.recording.readyAt?.toISOString() || null,
              publishedAt: s.recording.publishedAt?.toISOString() || null,
              fileName: s.recording.fileName,
              mimeType: s.recording.mimeType,
              bytes: s.recording.bytes?.toString() || null,
              durationSeconds: s.recording.durationSeconds,
              cleanupPending: !!s.recording.cleanupRequestedAt,
            }
          : null,
      })),
    };
  }
  async choices(
    kind: 'courses' | 'programs' | 'instructors' | 'items',
    q = '',
  ) {
    await this.authorize();
    if (q.length > 100) throw new StudentError('INVALID_INPUT');
    if (kind === 'courses')
      return (
        await this.db.course.findMany({
          where: q ? { title: { contains: q, mode: 'insensitive' } } : {},
          orderBy: { title: 'asc' },
          take: 50,
        })
      ).map((c) => ({ ref: handle('course', c.id), label: c.title }));
    if (kind === 'programs')
      return (
        await this.db.program.findMany({
          where: q ? { title: { contains: q, mode: 'insensitive' } } : {},
          orderBy: { title: 'asc' },
          take: 50,
        })
      ).map((c) => ({ ref: handle('program', c.id), label: c.title }));
    if (kind === 'items')
      return (
        await this.db.learningItem.findMany({
          where: { type: 'LIVE_SESSION', section: { courseId: q } },
          include: { section: { include: { course: true } } },
          orderBy: { position: 'asc' },
          take: 50,
        })
      ).map((i) => ({ ref: handle('item', i.id), label: i.title }));
    const users = await this.db.user.findMany({
      where: {
        role: 'INSTRUCTOR',
        ...(q ? { clerkUserId: { in: await this.directory.search(q) } } : {}),
      },
      orderBy: { id: 'asc' },
      select: { id: true, clerkUserId: true },
      take: 50,
    });
    const names = await this.directory.lookup(users.map((u) => u.clerkUserId));
    return users.map((u) => ({
      ref: handle('instructor', u.id),
      label: names.get(u.clerkUserId)?.name || 'Identity unavailable',
    }));
  }
}
