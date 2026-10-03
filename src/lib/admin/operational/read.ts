import 'server-only';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client';
import { AdminOperationalActions } from './actions';
import { adminHandle as h } from '../handles';
import type { Directory } from '../directory';
import { listParams, dates, latestSubmissions } from './queries';
import { StudentError } from '../../student/errors';
import {
  openPrivateFile,
  validatePrivateContent,
} from '../../storage/private-files';
import { uploadTypes } from '../../storage/submissions';
import { databaseUrl } from '../../db/config';
export type OperationalArea =
  | 'attendance'
  | 'submissions'
  | 'attempts'
  | 'certificates'
  | 'discussions'
  | 'support'
  | 'communications'
  | 'referrals';
export class AdminOperationalRepository extends AdminOperationalActions {
  constructor(
    db: PrismaClient,
    actorId: string,
    private directory: Directory,
    private schema = new URL(databaseUrl()).searchParams.get('schema') ||
      'public',
  ) {
    super(db, actorId);
  }
  private async names(ids: string[]) {
    const users = await this.db.user.findMany({
        where: { id: { in: [...new Set(ids)].slice(0, 100) } },
        select: { id: true, clerkUserId: true, studentId: true },
      }),
      names = await this.directory.lookup(users.map((u) => u.clerkUserId));
    return new Map(
      users.map((u) => [
        u.id,
        {
          ref: h('student', u.id),
          name:
            names.get(u.clerkUserId)?.name ||
            u.studentId ||
            'Identity unavailable',
        },
      ]),
    );
  }
  async overview() {
    await this.authorize();
    const [
      submissions,
      attempts,
      support,
      heldSessions,
      certificates,
      deliveries,
    ] = await Promise.all([
      this.db.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT count(*) ${latestSubmissions(this.schema, { status: 'SUBMITTED' })}`,
      ),
      this.db.academicAttempt.count({
        where: { status: 'SUBMITTED', requiresReview: true },
      }),
      this.db.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.db.batchSession.count({
        where: { status: 'HELD', attendance: { none: {} } },
      }),
      this.db.certificate.count({ where: { status: 'SUSPENDED' } }),
      this.db.communicationDelivery.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);
    const under = await this.db.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT count(*) ${latestSubmissions(this.schema, { status: 'UNDER_REVIEW' })}`,
    );
    return {
      pendingAssignments: Number(submissions[0].count) + Number(under[0].count),
      pendingText: attempts,
      openSupport: support,
      heldWithoutRecords: heldSessions,
      suspendedCertificates: certificates,
      deliveries: deliveries.map((d) => ({
        status: d.status,
        count: d._count._all,
      })),
    };
  }
  async list(
    area: OperationalArea,
    q: Record<string, string | undefined> = {},
  ) {
    await this.authorize();
    const p = listParams(q),
      common = { skip: p.skip, take: 20 },
      query = { contains: p.search, mode: 'insensitive' as const };
    const rows: {
      ref: string;
      title: string;
      context: string;
      status: string;
      at: string;
      student?: { ref: string; name: string };
      detail: string;
    }[] = [];
    let total: number;
    const valid = (values: string[]) => {
      if (q.status && !values.includes(q.status))
        throw new StudentError('INVALID_INPUT');
    };
    if (area === 'attendance') {
      valid(['SCHEDULED', 'HELD', 'CANCELLED']);
      const where: Prisma.BatchSessionWhereInput = {
        title: query,
        ...(q.batch ? { batchId: q.batch } : {}),
        ...(q.course
          ? {
              OR: [
                { courseId: q.course },
                { item: { section: { courseId: q.course } } },
              ],
            }
          : {}),
        ...(q.status ? { status: q.status as 'HELD' } : {}),
        startsAt: dates(q),
      };
      const [r, n] = await Promise.all([
        this.db.batchSession.findMany({
          where,
          ...common,
          orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
          include: { batch: true, _count: { select: { attendance: true } } },
        }),
        this.db.batchSession.count({ where }),
      ]);
      total = n;
      rows.push(
        ...r.map((s) => ({
          ref: h('session', s.id),
          title: s.title,
          context: s.batch.name,
          status: s.status,
          at: s.startsAt.toISOString(),
          detail: `${s._count.attendance} attendance records`,
        })),
      );
    } else if (area === 'submissions') {
      valid(['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'ACCEPTED']);
      const from = latestSubmissions(this.schema, q),
        [ids, count] = await Promise.all([
          this.db.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT s.id ${from} ORDER BY latest."submittedAt" DESC,s.id ASC LIMIT 20 OFFSET ${p.skip}`,
          ),
          this.db.$queryRaw<{ count: bigint }[]>(
            Prisma.sql`SELECT count(*) ${from}`,
          ),
        ]);
      total = Number(count[0].count);
      const r = await this.db.assignmentSubmission.findMany({
          where: { id: { in: ids.map((x) => x.id) } },
          include: {
            assignment: {
              include: {
                item: { include: { section: { include: { course: true } } } },
              },
            },
            versions: { orderBy: { number: 'desc' }, take: 1 },
          },
        }),
        names = await this.names(r.map((s) => s.userId));
      for (const id of ids) {
        const s = r.find((x) => x.id === id.id)!;
        rows.push({
          ref: h('submission', s.id),
          title: s.assignment.item.title,
          context: s.assignment.item.section.course.title,
          status: s.versions[0].status,
          at: s.versions[0].submittedAt.toISOString(),
          student: names.get(s.userId),
          detail: `Version ${s.versions[0].number}`,
        });
      }
    } else if (area === 'attempts') {
      valid(['PENDING', 'REVIEWED']);
      const where: Prisma.AcademicAttemptWhereInput = {
        status: 'SUBMITTED',
        responses: { some: { requiresReview: true } },
        activity: {
          item: {
            title: query,
            ...(q.course ? { section: { courseId: q.course } } : {}),
          },
        },
        ...(q.student ? { userId: q.student } : {}),
        ...(q.item ? { activityId: q.item } : {}),
        ...(q.status ? { requiresReview: q.status === 'PENDING' } : {}),
      };
      const [r, n] = await Promise.all([
        this.db.academicAttempt.findMany({
          where,
          ...common,
          orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
          include: {
            activity: {
              include: {
                item: { include: { section: { include: { course: true } } } },
              },
            },
            _count: {
              select: { responses: { where: { requiresReview: true } } },
            },
          },
        }),
        this.db.academicAttempt.count({ where }),
      ]);
      total = n;
      const names = await this.names(r.map((a) => a.userId));
      rows.push(
        ...r.map((a) => ({
          ref: h('attempt', a.id),
          title: a.activity.item.title,
          context: `${a.activity.itemType} · ${a.activity.item.section.course.title}`,
          status: a.requiresReview ? 'PENDING' : 'REVIEWED',
          at: a.submittedAt!.toISOString(),
          student: names.get(a.userId),
          detail: `Attempt ${a.number} · ${a.score}/${a.maxScore}`,
        })),
      );
    } else if (area === 'certificates') {
      valid(['ACTIVE', 'SUSPENDED', 'REVOKED']);
      const where: Prisma.CertificateWhereInput = {
        code: query,
        ...(q.course ? { courseId: q.course } : {}),
        ...(q.student ? { userId: q.student } : {}),
        ...(q.status ? { status: q.status as 'ACTIVE' } : {}),
      };
      const [r, n] = await Promise.all([
        this.db.certificate.findMany({
          where,
          ...common,
          orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
          include: { course: true },
        }),
        this.db.certificate.count({ where }),
      ]);
      total = n;
      const names = await this.names(r.map((a) => a.userId));
      rows.push(
        ...r.map((a) => ({
          ref: h('certificate', a.id),
          title: a.code,
          context: a.course.title,
          status: a.status,
          at: a.issuedAt.toISOString(),
          student: names.get(a.userId),
          detail: a.adminSuspended ? 'Admin suspension' : 'Policy status',
        })),
      );
    } else if (area === 'discussions') {
      valid(['LOCKED', 'OPEN']);
      const where: Prisma.DiscussionThreadWhereInput = {
        title: query,
        ...(q.course ? { courseId: q.course } : {}),
        ...(q.batch ? { batchId: q.batch } : {}),
        ...(q.status ? { locked: q.status === 'LOCKED' } : {}),
      };
      const [r, n] = await Promise.all([
        this.db.discussionThread.findMany({
          where,
          ...common,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          include: {
            course: true,
            batch: true,
            _count: { select: { posts: true } },
          },
        }),
        this.db.discussionThread.count({ where }),
      ]);
      total = n;
      const names = await this.names(r.map((a) => a.authorId));
      rows.push(
        ...r.map((a) => ({
          ref: h('thread', a.id),
          title: a.title,
          context: `${a.course.title} · ${a.batch?.name || 'Course-wide'}`,
          status: a.locked ? 'LOCKED' : 'OPEN',
          at: a.updatedAt.toISOString(),
          student: names.get(a.authorId),
          detail: `${a._count.posts} posts`,
        })),
      );
    } else if (area === 'support') {
      valid(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
      const where: Prisma.SupportTicketWhereInput = {
        ...(p.search ? { OR: [{ subject: query }, { reference: query }] } : {}),
        ...(q.student ? { userId: q.student } : {}),
        ...(q.status ? { status: q.status as 'OPEN' } : {}),
      };
      const [r, n] = await Promise.all([
        this.db.supportTicket.findMany({
          where,
          ...common,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          include: { _count: { select: { messages: true } } },
        }),
        this.db.supportTicket.count({ where }),
      ]);
      total = n;
      const names = await this.names(r.map((a) => a.userId));
      rows.push(
        ...r.map((a) => ({
          ref: h('ticket', a.id),
          title: a.subject,
          context: a.reference,
          status: a.status,
          at: a.updatedAt.toISOString(),
          student: names.get(a.userId),
          detail: `${a.category} · ${a._count.messages} messages`,
        })),
      );
    } else if (area === 'communications') {
      valid(['PENDING_PROVIDER', 'SUPPRESSED']);
      const where: Prisma.CommunicationMessageWhereInput = {
        subject: query,
        ...(q.batch ? { batchId: q.batch } : {}),
        ...(q.status
          ? { deliveries: { some: { status: q.status as 'SUPPRESSED' } } }
          : {}),
      };
      const [r, n] = await Promise.all([
        this.db.communicationMessage.findMany({
          where,
          ...common,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          include: { batch: true, _count: { select: { deliveries: true } } },
        }),
        this.db.communicationMessage.count({ where }),
      ]);
      total = n;
      rows.push(
        ...r.map((a) => ({
          ref: h('message', a.id),
          title: a.subject,
          context: `${a.batch.name} · ${a.channel} · ${a.purpose}`,
          status: 'PLANNED',
          at: a.createdAt.toISOString(),
          detail: `${a._count.deliveries} delivery plans · provider unavailable`,
        })),
      );
    } else {
      const users = p.search ? await this.directory.search(p.search) : [],
        where: Prisma.ReferralIdentityWhereInput = p.search
          ? {
              OR: [
                { code: query },
                { user: { studentId: query } },
                { user: { clerkUserId: { in: users } } },
              ],
            }
          : {};
      const [r, n] = await Promise.all([
        this.db.referralIdentity.findMany({
          where,
          ...common,
          orderBy: [{ createdAt: 'desc' }, { userId: 'asc' }],
          include: {
            user: { select: { _count: { select: { referrals: true } } } },
          },
        }),
        this.db.referralIdentity.count({ where }),
      ]);
      total = n;
      const names = await this.names(r.map((a) => a.userId));
      rows.push(
        ...r.map((a) => ({
          ref: h('student', a.userId),
          title: a.code,
          context: 'Referral identity',
          status: 'READ_ONLY',
          at: a.createdAt.toISOString(),
          student: names.get(a.userId),
          detail: `${a.user._count.referrals} attributions`,
        })),
      );
    }
    return { rows, total, page: p.page };
  }
  async session(sessionId: string, q: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = listParams(q),
      s = await this.db.batchSession.findUnique({
        where: { id: sessionId },
        include: { batch: true, course: true },
      });
    if (!s) throw new StudentError('NOT_FOUND');
    const where: Prisma.BatchMembershipWhereInput = {
      batchId: s.batchId,
      joinedAt: { lte: s.startsAt },
      OR: [{ leftAt: null }, { leftAt: { gt: s.startsAt } }],
      student: { role: 'STUDENT' },
    };
    const [members, total] = await Promise.all([
      this.db.batchMembership.findMany({
        where,
        skip: p.skip,
        take: 20,
        orderBy: { userId: 'asc' },
        include: { attendance: { where: { sessionId } } },
      }),
      this.db.batchMembership.count({ where }),
    ]);
    const names = await this.names(members.map((m) => m.userId));
    return {
      ref: h('session', s.id),
      title: s.title,
      batch: s.batch.name,
      batchRef: h('batch', s.batchId),
      course: s.course?.title ?? 'Batch session',
      startsAt: s.startsAt.toISOString(),
      status: s.status,
      page: p.page,
      total,
      rows: members.map((m) => ({
        membershipRef: h('membership', m.id),
        student: names.get(m.userId)!,
        status: (m.attendance[0]?.status ?? 'UNRECORDED') as
          'UNRECORDED' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
        recordedAt: m.attendance[0]?.recordedAt.toISOString() ?? null,
      })),
    };
  }
  async submission(
    submissionId: string,
    q: Record<string, string | undefined> = {},
  ) {
    await this.authorize();
    const p = listParams(q),
      s = await this.db.assignmentSubmission.findUnique({
        where: { id: submissionId },
        include: {
          assignment: {
            include: {
              item: { include: { section: { include: { course: true } } } },
            },
          },
          _count: { select: { versions: true } },
        },
      });
    if (!s) throw new StudentError('NOT_FOUND');
    const versions = await this.db.submissionVersion.findMany({
        where: { submissionId },
        orderBy: { number: 'desc' },
        skip: p.skip,
        take: 20,
        include: {
          files: true,
          reviews: { orderBy: { reviewedAt: 'desc' }, take: 20 },
        },
      }),
      names = await this.names([
        s.userId,
        ...versions.flatMap((v) => v.reviews.map((r) => r.reviewerId)),
      ]);
    const latest = await this.db.submissionVersion.findFirstOrThrow({
      where: { submissionId },
      orderBy: { number: 'desc' },
      select: { id: true },
    });
    return {
      ref: h('submission', s.id),
      title: s.assignment.item.title,
      student: names.get(s.userId)!,
      course: s.assignment.item.section.course.title,
      courseRef: h('course', s.assignment.item.section.courseId),
      itemRef: h('item', s.assignmentId),
      page: p.page,
      total: s._count.versions,
      versions: versions.map((v) => ({
        ref: h('version', v.id),
        number: v.number,
        latest: v.id === latest.id,
        status: v.status,
        text: v.text,
        kind: v.kind,
        at: v.submittedAt.toISOString(),
        files: v.files.map((file) => ({
          ref: h('file', file.id),
          fileName: file.fileName,
          mimeType: file.mimeType,
          bytes: file.bytes,
        })),
        reviews: v.reviews.map((r) => ({
          status: r.status,
          feedback: r.feedback,
          reviewer: names.get(r.reviewerId)?.name || 'Staff',
          at: r.reviewedAt.toISOString(),
        })),
      })),
    };
  }
  async attempt(attemptId: string) {
    await this.authorize();
    const a = await this.db.academicAttempt.findUnique({
      where: { id: attemptId },
      include: {
        activity: {
          include: {
            item: { include: { section: { include: { course: true } } } },
          },
        },
        responses: {
          orderBy: { position: 'asc' },
          take: 100,
          include: { options: { orderBy: { position: 'asc' } }, review: true },
        },
      },
    });
    if (!a || a.status !== 'SUBMITTED') throw new StudentError('NOT_FOUND');
    const names = await this.names([
      a.userId,
      ...a.responses.flatMap((r) => (r.review ? [r.review.reviewerId] : [])),
    ]);
    return {
      ref: h('attempt', a.id),
      title: a.activity.item.title,
      kind: a.activity.itemType,
      student: names.get(a.userId)!,
      course: a.activity.item.section.course.title,
      courseRef: h('course', a.activity.item.section.courseId),
      itemRef: h('item', a.activityId),
      number: a.number,
      status: a.requiresReview ? 'PENDING' : 'REVIEWED',
      score: a.score,
      maxScore: a.maxScore,
      percentage: a.percentage,
      passed: a.passed,
      at: a.submittedAt!.toISOString(),
      responses: a.responses.map((r) => ({
        ref: h('response', r.id),
        type: r.type,
        prompt: r.prompt,
        text: r.text,
        points: r.points,
        awardedPoints: r.review?.awardedPoints ?? r.awardedPoints,
        manual:
          r.requiresReview && ['SHORT_TEXT', 'LONG_TEXT'].includes(r.type),
        options: r.options.map((o) => ({
          label: o.label,
          correct: o.correct,
          selected: o.selected,
        })),
        review: r.review
          ? {
              feedback: r.review.feedback,
              reviewer: names.get(r.review.reviewerId)?.name || 'Staff',
              at: r.review.reviewedAt.toISOString(),
            }
          : null,
      })),
    };
  }
  async certificateDetail(id: string) {
    await this.authorize();
    const c = await this.db.certificate.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!c) throw new StudentError('NOT_FOUND');
    const names = await this.names([c.userId]),
      enrollment = await this.db.enrollment.findUnique({
        where: { userId_courseId: { userId: c.userId, courseId: c.courseId } },
        select: { completedAt: true },
      });
    return {
      ref: h('certificate', c.id),
      code: c.code,
      student: names.get(c.userId)!,
      course: c.course.title,
      status: c.status,
      adminSuspended: c.adminSuspended,
      issuedAt: c.issuedAt.toISOString(),
      firstCompletedAt: enrollment?.completedAt?.toISOString() ?? null,
      documentAvailable: !!c.storageKey,
    };
  }
  async discussion(
    threadId: string,
    q: Record<string, string | undefined> = {},
  ) {
    await this.authorize();
    const p = listParams(q),
      t = await this.db.discussionThread.findUnique({
        where: { id: threadId },
        include: {
          course: true,
          batch: true,
          _count: { select: { posts: true } },
        },
      });
    if (!t) throw new StudentError('NOT_FOUND');
    const posts = await this.db.discussionPost.findMany({
        where: { threadId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: p.skip,
        take: 20,
      }),
      names = await this.names([t.authorId, ...posts.map((p) => p.authorId)]);
    return {
      ref: h('thread', t.id),
      title: t.title,
      author: names.get(t.authorId)!.name,
      course: t.course.title,
      batch: t.batch?.name ?? 'Course-wide',
      locked: t.locked,
      page: p.page,
      total: t._count.posts,
      posts: posts.map((p) => ({
        author: names.get(p.authorId)!.name,
        body: p.body,
        at: p.createdAt.toISOString(),
      })),
    };
  }
  async ticket(ticketId: string, q: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = listParams(q),
      t = await this.db.supportTicket.findUnique({
        where: { id: ticketId },
        include: { _count: { select: { messages: true } } },
      });
    if (!t) throw new StudentError('NOT_FOUND');
    const messages = await this.db.supportMessage.findMany({
        where: { ticketId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: p.skip,
        take: 20,
      }),
      names = await this.names([t.userId, ...messages.map((m) => m.senderId)]);
    return {
      ref: h('ticket', t.id),
      title: t.subject,
      reference: t.reference,
      student: names.get(t.userId)!,
      category: t.category,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      page: p.page,
      total: t._count.messages,
      messages: messages.reverse().map((m) => ({
        actor: m.actor,
        author: names.get(m.senderId)!.name,
        body: m.body,
        at: m.createdAt.toISOString(),
      })),
    };
  }
  async message(messageId: string, q: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = listParams(q),
      m = await this.db.communicationMessage.findUnique({
        where: { id: messageId },
        include: { batch: true, _count: { select: { deliveries: true } } },
      });
    if (!m) throw new StudentError('NOT_FOUND');
    const rows = await this.db.communicationDelivery.findMany({
        where: { messageId },
        orderBy: { userId: 'asc' },
        skip: p.skip,
        take: 20,
      }),
      names = await this.names([m.initiatorId, ...rows.map((r) => r.userId)]),
      counts = await this.db.communicationDelivery.groupBy({
        by: ['status'],
        where: { messageId },
        _count: { _all: true },
      });
    return {
      ref: h('message', m.id),
      subject: m.subject,
      body: m.body,
      batch: m.batch.name,
      channel: m.channel,
      purpose: m.purpose,
      initiator: names.get(m.initiatorId)!.name,
      at: m.createdAt.toISOString(),
      page: p.page,
      total: m._count.deliveries,
      counts: counts.map((c) => ({ status: c.status, count: c._count._all })),
      rows: rows.map((r) => ({
        student: names.get(r.userId)!.name,
        status: r.status,
        reason: r.reason,
      })),
    };
  }
  async referral(userId: string, q: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = listParams(q),
      i = await this.db.referralIdentity.findUnique({ where: { userId } });
    if (!i) throw new StudentError('NOT_FOUND');
    const [r, total] = await Promise.all([
        this.db.referralAttribution.findMany({
          where: { referrerId: userId },
          skip: p.skip,
          take: 20,
          orderBy: [{ joinedAt: 'desc' }, { referredUserId: 'asc' }],
        }),
        this.db.referralAttribution.count({ where: { referrerId: userId } }),
      ]),
      names = await this.names([userId, ...r.map((a) => a.referredUserId)]);
    return {
      code: i.code,
      student: names.get(userId)!,
      createdAt: i.createdAt.toISOString(),
      page: p.page,
      total,
      rows: r.map((a) => ({
        student: names.get(a.referredUserId)!,
        joinedAt: a.joinedAt.toISOString(),
      })),
    };
  }
  async file(submissionId: string, fileId: string) {
    await this.authorize();
    const f = await this.db.submissionFile.findFirst({
      where: { id: fileId, version: { submissionId } },
    });
    if (!f) throw new StudentError('NOT_FOUND');
    if (!uploadTypes[f.mimeType] || f.bytes > 10 * 1024 ** 2)
      throw new StudentError('UNAVAILABLE');
    const { handle, size } = await openPrivateFile(
      process.env.LMS_SUBMISSIONS_ROOT,
      f.storageKey,
      10 * 1024 ** 2,
    );
    try {
      if (size !== f.bytes) throw new StudentError('UNAVAILABLE');
      const header = Buffer.alloc(16);
      await handle.read(header, 0, 16, 0);
      validatePrivateContent(header, f.mimeType);
    } finally {
      await handle.close();
    }
    await this.write('SubmissionFileInspected', async () => ({
      value: null,
      targetId: fileId,
      details: { submissionId, mimeType: f.mimeType, bytes: f.bytes },
    }));
    return { ...f, downloadAllowed: true };
  }
}
