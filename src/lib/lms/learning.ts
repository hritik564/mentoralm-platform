import 'server-only';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { entitledStudentWhere } from './entitlement';
import {
  safeLessonContent,
  approvedExternalLink,
  lessonMimes,
} from './content';
import { outlineSelect, projectCourse } from './course-projection';
import {
  attendanceProjection,
  attendanceMemberships,
  projectAttendance,
} from './attendance';
import { finalizeCourseProjection } from './completion';
import {
  openPrivateFile,
  validatePrivateContent,
} from '../storage/private-files';
type DB = Prisma.TransactionClient;
type Actor = { id: string; role: 'STUDENT' | 'ADMIN' | 'INSTRUCTOR' };
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
function validId(id: string) {
  if (!idPattern.test(id)) throw new StudentError('NOT_FOUND');
}
export function courseAccessWhere(id: string): Prisma.CourseWhereInput {
  return {
    published: true,
    enrollments: { some: { userId: id, user: entitledStudentWhere(id) } },
  };
}
export type LearningCourse = ReturnType<typeof finalizeCourseProjection>;
export class LearningRepository {
  constructor(
    private db: PrismaClient,
    private actor: Actor,
  ) {
    if (actor.role !== 'STUDENT') throw new StudentError('FORBIDDEN');
  }
  private async entitled(db: DB = this.db) {
    if (
      !(await db.user.findFirst({
        where: entitledStudentWhere(this.actor.id),
        select: { id: true },
      }))
    )
      throw new StudentError('FORBIDDEN');
  }
  async course(id: string) {
    await this.entitled();
    validId(id);
    const record = await this.db.course.findFirst({
      where: { id, ...courseAccessWhere(this.actor.id) },
      select: outlineSelect(this.actor.id),
    });
    if (!record) throw new StudentError('NOT_FOUND');
    return finalizeCourseProjection(
      projectCourse(record),
      await attendanceProjection(this.db, this.actor.id, record),
    );
  }
  /** Dashboard reads the same projection; denied students get no learning projection. */
  async dashboardSummaries() {
    const records = await this.db.course.findMany({
      where: courseAccessWhere(this.actor.id),
      select: outlineSelect(this.actor.id),
      orderBy: { id: 'asc' },
      take: 100,
    });
    const memberships = await attendanceMemberships(this.db, this.actor.id);
    return (
      await Promise.all(
        records.map(async (record) =>
          finalizeCourseProjection(
            projectCourse(record),
            projectAttendance(memberships, record),
          ),
        ),
      )
    ).sort(
      (a, b) =>
        (b.progress.lastAccessedAt || '').localeCompare(
          a.progress.lastAccessedAt || '',
        ) || a.id.localeCompare(b.id),
    );
  }
  async courses() {
    await this.entitled();
    return this.dashboardSummaries();
  }
  private async lessonRecord(
    courseId: string,
    itemId: string,
    db: DB = this.db,
  ) {
    await this.entitled(db);
    validId(courseId);
    validId(itemId);
    const record = await db.lesson.findFirst({
      where: {
        itemId,
        item: {
          published: true,
          type: 'LESSON',
          section: {
            published: true,
            courseId,
            course: courseAccessWhere(this.actor.id),
          },
        },
      },
      include: {
        item: { select: { title: true } },
        states: {
          where: { userId: this.actor.id },
          select: { completedAt: true },
        },
      },
    });
    if (!record) throw new StudentError('NOT_FOUND');
    return record;
  }
  async lesson(courseId: string, itemId: string) {
    const record = await this.lessonRecord(courseId, itemId);
    const content =
      record.format === 'TEXT'
        ? safeLessonContent(record.structuredContent)
        : null;
    const external =
      record.format === 'EXTERNAL'
        ? approvedExternalLink(record.externalTargetId)
        : null;
    const media = Boolean(
      process.env.LMS_FILES_ROOT &&
      record.storageKey &&
      record.mimeType &&
      lessonMimes[record.format]?.includes(record.mimeType) &&
      (record.format !== 'IMAGE' || record.altText),
    );
    return {
      id: itemId,
      title: record.item.title,
      format: record.format,
      content,
      external,
      media,
      altText: record.altText,
      downloadAllowed: record.downloadAllowed,
      captions: Boolean(media && record.captionsStorageKey),
      completed: Boolean(record.states[0]?.completedAt),
      available:
        record.format === 'TEXT'
          ? !!content
          : record.format === 'EXTERNAL'
            ? !!external
            : media,
    };
  }
  async media(courseId: string, itemId: string, captions = false) {
    const record = await this.lessonRecord(courseId, itemId);
    if (captions) {
      if (record.format !== 'VIDEO' || !record.captionsStorageKey)
        throw new StudentError('NOT_FOUND');
      return {
        storageKey: record.captionsStorageKey,
        mimeType: 'text/vtt',
        fileName: 'captions.vtt',
        downloadAllowed: false,
      };
    }
    if (
      !record.mimeType ||
      !lessonMimes[record.format]?.includes(record.mimeType)
    )
      throw new StudentError('NOT_FOUND');
    return {
      storageKey: record.storageKey,
      mimeType: record.mimeType,
      fileName: record.fileName || 'lesson',
      downloadAllowed: record.downloadAllowed,
    };
  }
  async resources(courseId?: string) {
    await this.entitled();
    if (courseId) validId(courseId);
    const records = await this.db.learningResource.findMany({
      where: {
        item: {
          published: true,
          type: 'RESOURCE',
          section: {
            published: true,
            ...(courseId ? { courseId } : {}),
            course: courseAccessWhere(this.actor.id),
          },
        },
      },
      select: {
        itemId: true,
        description: true,
        mimeType: true,
        downloadAllowed: true,
        storageKey: true,
        item: {
          select: {
            title: true,
            section: {
              select: {
                title: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { item: { section: { position: 'asc' } } },
        { item: { position: 'asc' } },
        { itemId: 'asc' },
      ],
      take: 200,
    });
    return records.map((r) => ({
      id: r.itemId,
      title: r.item.title,
      description: r.description,
      courseId: r.item.section.course.id,
      course: r.item.section.course.title,
      section: r.item.section.title,
      mimeType: r.mimeType,
      downloadAllowed: r.downloadAllowed,
      available: Boolean(process.env.LMS_FILES_ROOT && r.storageKey),
    }));
  }
  async resourceMedia(courseId: string, itemId: string) {
    await this.entitled();
    validId(courseId);
    validId(itemId);
    const r = await this.db.learningResource.findFirst({
      where: {
        itemId,
        item: {
          published: true,
          type: 'RESOURCE',
          section: {
            published: true,
            courseId,
            course: courseAccessWhere(this.actor.id),
          },
        },
      },
      select: {
        storageKey: true,
        mimeType: true,
        fileName: true,
        downloadAllowed: true,
      },
    });
    if (
      !r ||
      ![
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'text/plain',
      ].includes(r.mimeType)
    )
      throw new StudentError('NOT_FOUND');
    return r;
  }
  async record(courseId: string, itemId: string, complete: boolean) {
    for (let retry = 0; retry < 8; retry++) {
      try {
        return await this.db.$transaction(
          async (tx) => {
            const lesson = await this.lessonRecord(courseId, itemId, tx);
            if (complete) {
              if (lesson.format === 'IMAGE' && !lesson.altText)
                throw new StudentError('UNAVAILABLE');
              if (
                (lesson.format === 'TEXT' &&
                  !safeLessonContent(lesson.structuredContent)) ||
                (lesson.format === 'EXTERNAL' &&
                  !approvedExternalLink(lesson.externalTargetId))
              )
                throw new StudentError('UNAVAILABLE');
              if (lessonMimes[lesson.format]) {
                if (
                  !lesson.mimeType ||
                  !lessonMimes[lesson.format].includes(lesson.mimeType)
                )
                  throw new StudentError('UNAVAILABLE');
                const { handle } = await openPrivateFile(
                  process.env.LMS_FILES_ROOT,
                  lesson.storageKey,
                  lesson.format === 'VIDEO' ? 2 * 1024 ** 3 : 25 * 1024 ** 2,
                );
                try {
                  const header = Buffer.alloc(16);
                  await handle.read(header, 0, 16, 0);
                  validatePrivateContent(header, lesson.mimeType);
                } finally {
                  await handle.close();
                }
              }
            }
            const existing = await tx.lessonState.findUnique({
              where: { userId_itemId: { userId: this.actor.id, itemId } },
            });
            if (complete && existing?.completedAt) {
              const { evaluateCompletion } = await import('./completion');
              await evaluateCompletion(tx, this.actor.id, courseId);
              return;
            }
            const now = new Date(
              Math.max(Date.now(), existing?.lastAccessedAt.getTime() || 0),
            );
            await tx.lessonState.upsert({
              where: { userId_itemId: { userId: this.actor.id, itemId } },
              create: {
                userId: this.actor.id,
                itemId,
                firstAccessedAt: now,
                lastAccessedAt: now,
                completedAt: complete ? now : null,
              },
              update: {
                ...(complete
                  ? { completedAt: existing?.completedAt || now }
                  : { lastAccessedAt: now }),
              },
            });
            if (complete) {
              const { evaluateCompletion } = await import('./completion');
              await evaluateCompletion(tx, this.actor.id, courseId);
            }
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error.code === 'P2034' || error.code === 'P2002') &&
          retry < 7
        )
          continue;
        throw error;
      }
    }
  }
}
