import 'server-only';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { courseAccessWhere } from './learning';
import { entitledStudentWhere } from './entitlement';
import { academicTransaction } from './completion';
import { learningEvent } from './events';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const threadInput = z
  .object({
    courseId: id,
    batchId: id.optional(),
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(1).max(6000),
  })
  .strict();
export const postInput = z
  .object({ body: z.string().trim().min(1).max(6000) })
  .strict();
export function activeBatchWhere(
  userId: string,
  now = new Date(),
): Prisma.BatchWhereInput {
  return {
    status: 'ACTIVE',
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
    memberships: {
      some: {
        userId,
        status: 'ACTIVE',
        joinedAt: { lte: now },
        OR: [{ leftAt: null }, { leftAt: { gt: now } }],
      },
    },
  };
}
function batchScope(course: {
  id: string;
  programId: string | null;
}): Prisma.BatchWhereInput {
  return {
    OR: [
      { courseId: course.id },
      ...(course.programId ? [{ programId: course.programId }] : []),
      { courseId: null, programId: null },
    ],
  };
}
const threadSelect = {
  id: true,
  title: true,
  courseId: true,
  batchId: true,
  locked: true,
  createdAt: true,
  updatedAt: true,
  course: { select: { title: true } },
  batch: { select: { name: true } },
  _count: { select: { posts: true } },
} satisfies Prisma.DiscussionThreadSelect;
export class Discussions {
  constructor(
    private db: PrismaClient,
    private userId: string,
  ) {}
  private where(): Prisma.DiscussionThreadWhereInput {
    return {
      course: courseAccessWhere(this.userId),
      OR: [{ batchId: null }, { batch: activeBatchWhere(this.userId) }],
    };
  }
  async workspace() {
    if (
      !(await this.db.user.findFirst({
        where: entitledStudentWhere(this.userId),
        select: { id: true },
      }))
    )
      throw new StudentError('FORBIDDEN');
    const [courses, batches, threads] = await Promise.all([
      this.db.course.findMany({
        where: courseAccessWhere(this.userId),
        select: { id: true, title: true, programId: true },
        orderBy: { title: 'asc' },
        take: 100,
      }),
      this.db.batch.findMany({
        where: activeBatchWhere(this.userId),
        select: { id: true, name: true, courseId: true, programId: true },
        orderBy: { code: 'asc' },
        take: 100,
      }),
      this.db.discussionThread.findMany({
        where: this.where(),
        select: threadSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: 50,
      }),
    ]);
    return {
      courses,
      batches,
      threads: threads.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  }
  async thread(threadId: string, before?: string) {
    if (
      !id.safeParse(threadId).success ||
      (before && !id.safeParse(before).success)
    )
      throw new StudentError('INVALID_INPUT');
    const t = await this.db.discussionThread.findFirst({
      where: { id: threadId, ...this.where() },
      select: threadSelect,
    });
    if (!t) throw new StudentError('NOT_FOUND');
    const cursor = before
      ? await this.db.discussionPost.findFirst({
          where: { id: before, threadId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (before && !cursor) throw new StudentError('NOT_FOUND');
    const posts = await this.db.discussionPost.findMany({
      where: {
        threadId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: { id: true, body: true, createdAt: true, authorId: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
    const page = posts.slice(0, 50);
    return {
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      older: posts.length > 50 ? page.at(-1)!.id : null,
      posts: page.reverse().map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.createdAt.toISOString(),
        author: p.authorId === this.userId ? 'You' : 'Course member',
      })),
    };
  }
  async create(input: unknown) {
    const parsed = threadInput.safeParse(input);
    if (!parsed.success) throw new StudentError('INVALID_INPUT');
    const p = parsed.data;
    return academicTransaction(this.db, async (db) => {
      const course = await db.course.findFirst({
        where: { id: p.courseId, ...courseAccessWhere(this.userId) },
        select: { id: true, programId: true },
      });
      if (!course) throw new StudentError('NOT_FOUND');
      if (
        p.batchId &&
        !(await db.batch.findFirst({
          where: {
            id: p.batchId,
            AND: [activeBatchWhere(this.userId), batchScope(course)],
          },
          select: { id: true },
        }))
      )
        throw new StudentError('NOT_FOUND');
      const thread = await db.discussionThread.create({
        data: {
          courseId: p.courseId,
          batchId: p.batchId,
          authorId: this.userId,
          title: p.title,
          posts: { create: { authorId: this.userId, body: p.body } },
        },
        select: { id: true },
      });
      return thread;
    });
  }
  async reply(threadId: string, input: unknown) {
    const parsed = postInput.safeParse(input);
    if (!parsed.success || !id.safeParse(threadId).success)
      throw new StudentError('INVALID_INPUT');
    return academicTransaction(this.db, async (db) => {
      const thread = await db.discussionThread.findFirst({
        where: { id: threadId, ...this.where() },
        select: { id: true, locked: true, courseId: true },
      });
      if (!thread) throw new StudentError('NOT_FOUND');
      if (thread.locked) throw new StudentError('CONFLICT');
      const post = await db.discussionPost.create({
        data: { threadId, authorId: this.userId, body: parsed.data.body },
        select: { id: true },
      });
      await db.discussionThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      });
      await learningEvent(db, {
        kind: 'DiscussionReply',
        key: `reply:${post.id}`,
        subjectId: threadId,
        courseId: thread.courseId,
        userId: this.userId,
      });
      return post;
    });
  }
}
