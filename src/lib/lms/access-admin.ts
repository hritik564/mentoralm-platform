import 'server-only';
import { requireAdminPermission } from '../auth/admin-policy';
import type {
  Prisma,
  PrismaClient,
  LmsAccessOverride,
  EnrollmentStatus,
} from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { academicTransaction } from './completion';
export type LmsAccessCommand =
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
    };
/** Shared transaction-level rule used by the trusted control plane. Never accepts a client actor. */
export async function applyLmsAccessChange(
  db: Prisma.TransactionClient,
  actorId: string,
  command: LmsAccessCommand,
  reason?: string,
) {
  await requireAdminPermission(
    db,
    actorId,
    command.kind === 'BATCH_ACCESS' ? 'BATCHES_MANAGE' : 'STUDENTS_MANAGE',
  );
  let before: string | boolean | null, targetId: string;
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
    if (![null, 'ENROLLED', 'IN_PROGRESS', 'COMPLETED'].includes(command.value))
      throw new StudentError('INVALID_INPUT');
    if (
      !(await db.user.findFirst({
        where: { id: command.userId, role: 'STUDENT' },
        select: { id: true },
      }))
    )
      throw new StudentError('NOT_FOUND');
    const where = {
        userId_courseId: { userId: command.userId, courseId: command.courseId },
      },
      enrollment = await db.enrollment.findUnique({ where });
    before = enrollment?.status || null;
    targetId = `${command.userId}:${command.courseId}`;
    if (command.value === 'COMPLETED') throw new StudentError('INVALID_INPUT');
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
      actorId,
      action: `${command.kind}_${String(before)}_TO_${String(command.value)}`,
      targetId,
      details: { before, after: command.value, ...(reason ? { reason } : {}) },
    },
  });
}
export class LmsAccessAdmin {
  constructor(
    private db: PrismaClient,
    private actorId: string,
  ) {}
  async change(command: LmsAccessCommand, reason?: string) {
    return academicTransaction(this.db, (tx) =>
      applyLmsAccessChange(tx, this.actorId, command, reason),
    );
  }
}
