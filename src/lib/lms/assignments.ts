import 'server-only';
import type {
  Prisma,
  PrismaClient,
  SubmissionStatus,
} from '../../generated/prisma/client';
import { entitledStudentWhere } from './entitlement';
import { StudentError } from '../student/errors';
import { studentItem } from './academic-access';
import { submissionInput } from './academic-rules';
import { academicTransaction, evaluateCompletion } from './completion';
import {
  storeSubmissionFiles,
  removeSubmissionFiles,
} from '../storage/submissions';
import { courseAccessWhere } from './learning';
const historySelect = {
  id: true,
  number: true,
  submittedAt: true,
  kind: true,
  text: true,
  status: true,
  files: { select: { id: true, fileName: true, mimeType: true, bytes: true } },
  reviews: {
    orderBy: { reviewedAt: 'desc' as const },
    select: { feedback: true, status: true, reviewedAt: true },
  },
};
export class Assignments {
  constructor(
    private db: PrismaClient,
    private userId: string,
  ) {}
  private async assignment(
    db: Prisma.TransactionClient,
    courseId: string,
    itemId: string,
  ) {
    const item = await studentItem(
      db,
      this.userId,
      courseId,
      itemId,
      'ASSIGNMENT',
    );
    const a = await db.assignment.findFirst({
      where: { itemId, published: true },
    });
    if (!a) throw new StudentError('NOT_FOUND');
    return { ...a, title: item.title };
  }
  async list() {
    if (
      !(await this.db.user.findFirst({
        where: entitledStudentWhere(this.userId),
        select: { id: true },
      }))
    )
      throw new StudentError('FORBIDDEN');
    const records = await this.db.assignment.findMany({
      where: {
        published: true,
        item: {
          published: true,
          section: { published: true, course: courseAccessWhere(this.userId) },
        },
      },
      select: {
        itemId: true,
        dueAt: true,
        item: {
          select: {
            title: true,
            section: {
              select: { course: { select: { id: true, title: true } } },
            },
          },
        },
        submissions: {
          where: { userId: this.userId },
          select: {
            versions: {
              orderBy: { number: 'desc' },
              take: 1,
              select: { status: true },
            },
          },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { itemId: 'asc' }],
      take: 200,
    });
    return records.map((r) => ({
      id: r.itemId,
      title: r.item.title,
      courseId: r.item.section.course.id,
      course: r.item.section.course.title,
      dueAt: r.dueAt?.toISOString() || null,
      status: (r.submissions[0]?.versions[0]?.status || 'NOT_SUBMITTED') as
        SubmissionStatus | 'NOT_SUBMITTED',
    }));
  }
  async view(courseId: string, itemId: string) {
    const a = await this.assignment(this.db, courseId, itemId);
    const s = await this.db.assignmentSubmission.findUnique({
      where: {
        userId_assignmentId: { userId: this.userId, assignmentId: itemId },
      },
      select: {
        versions: {
          orderBy: { number: 'desc' },
          select: historySelect,
          take: 100,
        },
      },
    });
    const versions = (s?.versions || []).map((v) => ({
      ...v,
      submittedAt: v.submittedAt.toISOString(),
      reviews: v.reviews.map((r) => ({
        ...r,
        reviewedAt: r.reviewedAt.toISOString(),
      })),
    }));
    const current = versions[0];
    return {
      id: itemId,
      title: a.title,
      instructions: a.instructions,
      dueAt: a.dueAt?.toISOString() || null,
      allowedKinds: a.allowedKinds,
      maxFiles: a.maxFiles,
      maxFileBytes: a.maxFileBytes,
      requiresAcceptance: a.requiresAcceptance,
      canSubmit:
        !current ||
        (a.allowResubmission &&
          !['ACCEPTED', 'UNDER_REVIEW'].includes(current.status)),
      versions,
    };
  }
  async submit(
    courseId: string,
    itemId: string,
    input: unknown,
    files: File[] = [],
  ) {
    const parsed = submissionInput.safeParse(input);
    if (!parsed.success) throw new StudentError('INVALID_INPUT');
    const { kind, text, requestKey } = parsed.data;
    const policy = await this.assignment(this.db, courseId, itemId);
    if (
      !policy.allowedKinds.includes(kind) ||
      (kind !== 'FILE' && !text?.trim()) ||
      (kind === 'FILE' && text !== undefined) ||
      (kind === 'TEXT' ? files.length > 0 : files.length === 0)
    )
      throw new StudentError('INVALID_INPUT');
    const saved = await storeSubmissionFiles(
      files,
      policy.maxFiles,
      policy.maxFileBytes,
    );
    let used = false;
    try {
      const result = await academicTransaction(this.db, async (db) => {
        used = false;
        const a = await this.assignment(db, courseId, itemId);
        if (
          !a.allowedKinds.includes(kind) ||
          saved.length > a.maxFiles ||
          saved.some((f) => f.bytes > a.maxFileBytes)
        )
          throw new StudentError('INVALID_INPUT');
        const s = await db.assignmentSubmission.upsert({
          where: {
            userId_assignmentId: { userId: this.userId, assignmentId: itemId },
          },
          create: { userId: this.userId, assignmentId: itemId },
          update: {},
        });
        const prior = await db.submissionVersion.findUnique({
          where: {
            submissionId_requestKey: { submissionId: s.id, requestKey },
          },
        });
        if (prior) return { id: prior.id, number: prior.number };
        const latest = await db.submissionVersion.findFirst({
          where: { submissionId: s.id },
          orderBy: { number: 'desc' },
        });
        if (
          latest &&
          (!a.allowResubmission ||
            ['ACCEPTED', 'UNDER_REVIEW'].includes(latest.status))
        )
          throw new StudentError('FORBIDDEN');
        if ((latest?.number || 0) >= 100) throw new StudentError('FORBIDDEN');
        const version = await db.submissionVersion.create({
          data: {
            submissionId: s.id,
            number: (latest?.number || 0) + 1,
            requestKey,
            kind,
            text: text?.trim() || null,
            files: { create: saved },
          },
        });
        await evaluateCompletion(db, this.userId, courseId);
        used = true;
        return { id: version.id, number: version.number };
      });
      if (!used) await removeSubmissionFiles(saved);
      return result;
    } catch (error) {
      await removeSubmissionFiles(saved);
      throw error;
    }
  }
  async file(courseId: string, itemId: string, fileId: string) {
    await this.assignment(this.db, courseId, itemId);
    const file = await this.db.submissionFile.findFirst({
      where: {
        id: fileId,
        version: { submission: { assignmentId: itemId, userId: this.userId } },
      },
      select: { storageKey: true, fileName: true, mimeType: true },
    });
    if (!file) throw new StudentError('NOT_FOUND');
    return { ...file, downloadAllowed: true };
  }
}
