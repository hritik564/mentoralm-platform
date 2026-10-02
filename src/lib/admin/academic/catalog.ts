import 'server-only';
import { AcademicCore, courseContext, itemContext } from './core';
import { adminHandle as h } from '../handles';
import { StudentError } from '../../student/errors';
import { externalRegistry, approvedExternalLink } from '../../lms/content';
function pageParams(q: Record<string, string | undefined>) {
  const page = Number(q.page || 1),
    search = (q.q || '').trim();
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000 ||
    search.length > 100
  )
    throw new StudentError('INVALID_INPUT');
  return { page, search, skip: (page - 1) * 20 };
}
export class AcademicCatalog extends AcademicCore {
  async programs(q: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = pageParams(q),
      where = { title: { contains: p.search, mode: 'insensitive' as const } };
    const [rows, total] = await Promise.all([
      this.db.program.findMany({
        where,
        include: { _count: { select: { courses: true } } },
        orderBy: { id: 'asc' },
        skip: p.skip,
        take: 20,
      }),
      this.db.program.count({ where }),
    ]);
    return {
      page: p.page,
      total,
      rows: rows.map((r) => ({
        ref: h('program', r.id),
        title: r.title,
        courses: r._count.courses,
      })),
    };
  }
  async courses(q: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = pageParams(q);
    if (q.status && !['DRAFT', 'PUBLISHED'].includes(q.status))
      throw new StudentError('INVALID_INPUT');
    const where = {
      title: { contains: p.search, mode: 'insensitive' as const },
      ...(q.program ? { programId: q.program } : {}),
      ...(q.status ? { published: q.status === 'PUBLISHED' } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.course.findMany({
        where,
        include: {
          program: true,
          _count: { select: { enrollments: true, sections: true } },
        },
        orderBy: { id: 'asc' },
        skip: p.skip,
        take: 20,
      }),
      this.db.course.count({ where }),
    ]);
    return {
      page: p.page,
      total,
      rows: rows.map((r) => ({
        ref: h('course', r.id),
        title: r.title,
        program: r.program?.title || 'Independent',
        published: r.published,
        sections: r._count.sections,
        enrollments: r._count.enrollments,
      })),
    };
  }
  async builder(courseId: string) {
    await this.authorize();
    const c = await courseContext(this.db, courseId);
    if (
      (await this.db.section.count({ where: { courseId } })) > 50 ||
      (await this.db.learningItem.count({ where: { section: { courseId } } })) >
        500
    )
      throw new StudentError('UNAVAILABLE');
    const sections = await this.db.section.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      take: 50,
      include: {
        items: {
          orderBy: { position: 'asc' },
          take: 100,
          include: {
            lesson: { select: { format: true } },
            activity: { select: { published: true } },
            assignment: { select: { published: true } },
            _count: { select: { sessions: true } },
          },
        },
      },
    });
    return {
      ref: h('course', c.id),
      title: c.title,
      description: c.description,
      programRef: c.programId ? h('program', c.programId) : null,
      thumbnailPath: c.thumbnailPath,
      thumbnailAlt: c.thumbnailAlt,
      publicPath: c.publicPath,
      published: c.published,
      academicCompletionEnabled: c.academicCompletionEnabled,
      certificateEnabled: c.certificateEnabled,
      requiredAttendancePercent: c.requiredAttendancePercent,
      sections: sections.map((s) => ({
        ref: h('section', s.id),
        title: s.title,
        description: s.description,
        published: s.published,
        position: s.position,
        items: s.items.map((i) => ({
          ref: h('item', i.id),
          title: i.title,
          type: i.type,
          required: i.required,
          published: i.published,
          position: i.position,
          format: i.lesson?.format || null,
          occurrences: i._count.sessions,
        })),
      })),
    };
  }
  async item(courseId: string, sectionId: string, itemId: string) {
    await this.authorize();
    const i = await itemContext(this.db, courseId, sectionId, itemId);
    const [lesson, resource, activity, assignment, sessions] =
      await Promise.all([
        this.db.lesson.findUnique({ where: { itemId } }),
        this.db.learningResource.findUnique({ where: { itemId } }),
        this.db.academicActivity.findUnique({
          where: { itemId },
          include: {
            questions: {
              orderBy: { position: 'asc' },
              include: {
                question: { select: { id: true, prompt: true, type: true } },
              },
            },
            _count: { select: { attempts: true } },
          },
        }),
        this.db.assignment.findUnique({
          where: { itemId },
          include: { _count: { select: { submissions: true } } },
        }),
        this.db.batchSession.findMany({
          where: { itemId },
          take: 50,
          orderBy: { startsAt: 'desc' },
          include: {
            batch: { select: { id: true, name: true, code: true } },
            recording: { select: { status: true, cleanupRequestedAt: true } },
          },
        }),
      ]);
    return {
      ref: h('item', i.id),
      title: i.title,
      type: i.type,
      required: i.required,
      published: i.published,
      lesson: lesson
        ? {
            format: lesson.format,
            structuredContent: lesson.structuredContent,
            externalTargetId: lesson.externalTargetId,
            downloadAllowed: lesson.downloadAllowed,
            altText: lesson.altText,
            durationSeconds: lesson.durationSeconds,
            fileName: lesson.fileName,
            mimeType: lesson.mimeType,
            attached: !!lesson.storageKey,
          }
        : null,
      resource: resource
        ? {
            description: resource.description,
            downloadAllowed: resource.downloadAllowed,
            fileName: resource.fileName,
            mimeType: resource.mimeType,
            attached: !!resource.storageKey,
          }
        : null,
      activity: activity
        ? {
            instructions: activity.instructions,
            passingPercent: activity.passingPercent,
            attemptLimit: activity.attemptLimit,
            reviewAnswers: activity.reviewAnswers,
            attempts: activity._count.attempts,
            questions: activity.questions.map((q) => ({
              questionRef: h('question', q.questionId),
              prompt: q.question.prompt,
              type: q.question.type,
              points: q.points,
            })),
          }
        : null,
      assignment: assignment
        ? {
            instructions: assignment.instructions,
            dueAt: assignment.dueAt?.toISOString() || null,
            allowedKinds: assignment.allowedKinds,
            maxFiles: assignment.maxFiles,
            maxFileBytes: assignment.maxFileBytes,
            requiresAcceptance: assignment.requiresAcceptance,
            allowResubmission: assignment.allowResubmission,
            submissions: assignment._count.submissions,
          }
        : null,
      sessions: sessions.map((s) => ({
        ref: h('session', s.id),
        batchRef: h('batch', s.batchId),
        batch: s.batch.name,
        title: s.title,
        startsAt: s.startsAt.toISOString(),
        status: s.status,
        recording: s.recording?.cleanupRequestedAt
          ? 'CLEANUP_PENDING'
          : s.recording?.status || 'NO_RECORDING',
      })),
      externalTargets: Object.keys(externalRegistry().links).filter((k) =>
        approvedExternalLink(k),
      ),
      mediaAvailable: !!process.env.LMS_FILES_ROOT,
    };
  }
  async banks(q: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = pageParams(q),
      where = { title: { contains: p.search, mode: 'insensitive' as const } };
    const [rows, total] = await Promise.all([
      this.db.questionBank.findMany({
        where,
        orderBy: { id: 'asc' },
        take: 20,
        skip: p.skip,
        include: { _count: { select: { questions: true } } },
      }),
      this.db.questionBank.count({ where }),
    ]);
    return {
      page: p.page,
      total,
      rows: rows.map((b) => ({
        ref: h('bank', b.id),
        title: b.title,
        questions: b._count.questions,
      })),
    };
  }
  async bank(bankId: string, q: Record<string, string | undefined> = {}) {
    await this.authorize();
    const b = await this.db.questionBank.findUnique({ where: { id: bankId } });
    if (!b) throw new StudentError('NOT_FOUND');
    const p = pageParams(q),
      where = {
        bankId,
        prompt: { contains: p.search, mode: 'insensitive' as const },
      };
    const [rows, total] = await Promise.all([
      this.db.question.findMany({
        where,
        orderBy: { position: 'asc' },
        take: 20,
        skip: p.skip,
        include: {
          options: { orderBy: { position: 'asc' } },
          _count: { select: { activities: true } },
        },
      }),
      this.db.question.count({ where }),
    ]);
    return {
      ref: h('bank', b.id),
      title: b.title,
      page: p.page,
      total,
      rows: rows.map((r) => ({
        ref: h('question', r.id),
        type: r.type,
        prompt: r.prompt,
        explanation: r.explanation,
        published: r.published,
        uses: r._count.activities,
        options: r.options.map((o) => ({ label: o.label, correct: o.correct })),
      })),
    };
  }
  async activities(q: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = pageParams(q);
    if (q.type && !['QUIZ', 'ASSESSMENT', 'ASSIGNMENT'].includes(q.type))
      throw new StudentError('INVALID_INPUT');
    const where = {
      type: {
        in: q.type
          ? [q.type as 'QUIZ' | 'ASSESSMENT' | 'ASSIGNMENT']
          : (['QUIZ', 'ASSESSMENT', 'ASSIGNMENT'] as (
              'QUIZ' | 'ASSESSMENT' | 'ASSIGNMENT'
            )[]),
      },
      title: { contains: p.search, mode: 'insensitive' as const },
    };
    const [rows, total] = await Promise.all([
      this.db.learningItem.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: p.skip,
        take: 20,
        include: {
          section: {
            include: { course: { select: { id: true, title: true } } },
          },
        },
      }),
      this.db.learningItem.count({ where }),
    ]);
    return {
      page: p.page,
      total,
      rows: rows.map((i) => ({
        ref: h('item', i.id),
        courseRef: h('course', i.section.courseId),
        sectionRef: h('section', i.sectionId),
        course: i.section.course.title,
        title: i.title,
        type: i.type,
        published: i.published,
      })),
    };
  }
  async liveBatches(courseId: string) {
    await this.authorize();
    const c = await courseContext(this.db, courseId);
    const rows = await this.db.batch.findMany({
      where: {
        OR: [
          { courseId },
          ...(c.programId ? [{ programId: c.programId }] : []),
          { courseId: null, programId: null },
        ],
      },
      orderBy: { id: 'asc' },
      take: 50,
    });
    return rows.map((b) => ({ ref: h('batch', b.id), name: b.name }));
  }
}
