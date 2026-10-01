import 'server-only';
import type {
  PrismaClient,
  LmsAccessOverride,
  EnrollmentStatus,
} from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { academicTransaction } from './completion';
/** Trusted future control plane, no public/student route. Each mutation is role-checked and audited atomically. */
export class LmsAccessAdmin {
  constructor(
    private db: PrismaClient,
    private actorId: string,
  ) {}
  async change(
    command:
      | {
          kind: 'STUDENT_OVERRIDE';
          userId: string;
          value: LmsAccessOverride | null;
        }
      | { kind: 'BATCH_ACCESS'; batchId: string; value: boolean }
      | {
          kind: 'ENROLLMENT';
          userId: string;
          courseId: string;
          value: EnrollmentStatus | null;
        },
  ) {
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
      let before: unknown, targetId: string;
      if (command.kind === 'STUDENT_OVERRIDE') {
        if (![null, 'ENABLED', 'DISABLED'].includes(command.value))
          throw new StudentError('INVALID_INPUT');
        const user = await db.user.findFirst({
          where: { id: command.userId, role: 'STUDENT' },
          select: { lmsAccessOverride: true },
        });
        if (!user) throw new StudentError('NOT_FOUND');
        before = user.lmsAccessOverride;
        targetId = command.userId;
        await db.user.update({
          where: { id: targetId },
          data: { lmsAccessOverride: command.value },
        });
      } else if (command.kind === 'BATCH_ACCESS') {
        if (typeof command.value !== 'boolean')
          throw new StudentError('INVALID_INPUT');
        const batch = await db.batch.findUnique({
          where: { id: command.batchId },
          select: { lmsAccessEnabled: true },
        });
        if (!batch) throw new StudentError('NOT_FOUND');
        before = batch.lmsAccessEnabled;
        targetId = command.batchId;
        await db.batch.update({
          where: { id: targetId },
          data: { lmsAccessEnabled: command.value },
        });
      } else {
        if (
          ![null, 'ENROLLED', 'IN_PROGRESS', 'COMPLETED'].includes(
            command.value,
          )
        )
          throw new StudentError('INVALID_INPUT');
        if (
          !(await db.user.findFirst({
            where: { id: command.userId, role: 'STUDENT' },
            select: { id: true },
          }))
        )
          throw new StudentError('NOT_FOUND');
        const where = {
          userId_courseId: {
            userId: command.userId,
            courseId: command.courseId,
          },
        };
        const enrollment = await db.enrollment.findUnique({ where });
        before = enrollment?.status || null;
        targetId = `${command.userId}:${command.courseId}`;
        // Completion is owned by evaluateCompletion, including privileged operations.
        if (command.value === 'COMPLETED')
          throw new StudentError('INVALID_INPUT');
        if (command.value === null) {
          if (enrollment) await db.enrollment.delete({ where });
        } else
          await db.enrollment.upsert({
            where,
            create: { ...where.userId_courseId, status: command.value },
            update: { status: command.value },
          });
      }
      await db.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: `${command.kind}_${String(before)}_TO_${String(command.value)}`,
          targetId,
        },
      });
    });
  }
}
