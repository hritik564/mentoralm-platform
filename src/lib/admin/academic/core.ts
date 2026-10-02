import 'server-only';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client';
import { requireAdmin } from '../../auth/roles';
import { academicTransaction } from '../../lms/completion';
import { StudentError } from '../../student/errors';
export type TX = Prisma.TransactionClient;
export class AcademicCore {
  constructor(
    protected db: PrismaClient,
    protected actorId: string,
  ) {}
  async authorize() {
    await requireAdmin(this.db, this.actorId);
  }
  protected async write<T>(
    action: string,
    work: (tx: TX) => Promise<{
      value: T;
      targetId: string;
      details: Prisma.InputJsonObject;
    }>,
  ) {
    return academicTransaction(this.db, async (tx) => {
      await requireAdmin(tx, this.actorId);
      const r = await work(tx);
      await tx.academicAudit.create({
        data: {
          actorId: this.actorId,
          action,
          targetId: r.targetId,
          details: r.details,
        },
      });
      return r.value;
    });
  }
}
export async function courseContext(tx: TX, courseId: string) {
  const c = await tx.course.findUnique({ where: { id: courseId } });
  if (!c) throw new StudentError('NOT_FOUND');
  return c;
}
export async function sectionContext(
  tx: TX,
  courseId: string,
  sectionId: string,
) {
  const s = await tx.section.findFirst({ where: { id: sectionId, courseId } });
  if (!s) throw new StudentError('NOT_FOUND');
  return s;
}
export async function itemContext(
  tx: TX,
  courseId: string,
  sectionId: string,
  itemId: string,
) {
  const i = await tx.learningItem.findFirst({
    where: { id: itemId, sectionId, section: { courseId } },
  });
  if (!i) throw new StudentError('NOT_FOUND');
  return i;
}
export async function itemHasHistory(tx: TX, itemId: string) {
  const [states, attempts, submissions, sessions] = await Promise.all([
    tx.lessonState.count({ where: { itemId } }),
    tx.academicAttempt.count({ where: { activityId: itemId } }),
    tx.assignmentSubmission.count({ where: { assignmentId: itemId } }),
    tx.batchSession.count({ where: { itemId } }),
  ]);
  return states + attempts + submissions + sessions > 0;
}
