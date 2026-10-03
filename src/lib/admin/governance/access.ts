import 'server-only';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient, Prisma } from '../../../generated/prisma/client';
import { academicTransaction } from '../../lms/completion';
import { getEffectiveRoles, hasRole } from '../../auth/roles';
import { requireGovernance } from '../../auth/admin-policy';
import { StudentError } from '../../student/errors';
import { parseInput } from '../validation';
import { text } from '../academic/validation';
import { adminPermissions } from '../permissions';
import type { Directory } from '../directory';
const reason = text(500);
export const roleChangeInput = z
  .object({
    role: z.enum(['STUDENT', 'ADMIN', 'INSTRUCTOR']),
    operation: z.enum(['grant', 'revoke']),
    expectedState: z.string().regex(/^[a-f0-9]{64}$/),
    confirmation: z.literal(true),
    reason,
  })
  .strict();
export const policyChangeInput = z
  .object({
    authority: z.enum(['SCOPED', 'GOVERNANCE']),
    permissions: z
      .array(z.enum(adminPermissions))
      .max(12)
      .refine((p) => new Set(p).size === p.length),
    expectedRevision: z.uuid().nullable(),
    confirmation: z.literal(true),
    reason,
  })
  .strict()
  .refine((p) => p.authority !== 'GOVERNANCE' || p.permissions.length === 0);
export async function governanceTransaction<T>(
  db: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return academicTransaction(db, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(19748962, 4)`;
    return work(tx);
  });
}
export async function accessState(
  db: Prisma.TransactionClient,
  userId: string,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: { orderBy: { role: 'asc' } },
      adminAuthorization: true,
    },
  });
  if (!user) throw new StudentError('NOT_FOUND');
  const state = createHash('sha256')
    .update(
      JSON.stringify([
        user.id,
        user.role,
        user.roleAssignments.map((r) => r.role),
        user.adminAuthorization?.revision || null,
      ]),
    )
    .digest('hex');
  return { user, state };
}
export async function protectGovernor(
  db: Prisma.TransactionClient,
  actorId: string,
  targetId: string,
) {
  const before = await db.adminAuthorization.findUnique({
    where: { userId: targetId },
  });
  if (before?.authority !== 'GOVERNANCE') return;
  if (actorId === targetId) throw new StudentError('CONFLICT');
  const remaining = await db.adminAuthorization.count({
    where: {
      userId: { not: targetId },
      authority: 'GOVERNANCE',
      user: {
        OR: [
          { role: 'ADMIN' },
          { roleAssignments: { some: { role: 'ADMIN' } } },
        ],
      },
    },
  });
  if (!remaining) throw new StudentError('CONFLICT');
}
export class GovernanceAccess {
  constructor(
    protected db: PrismaClient,
    protected actorId: string,
    protected directory: Directory,
  ) {}
  async role(targetId: string, input: unknown) {
    const c = parseInput(roleChangeInput, input);
    return governanceTransaction(this.db, async (tx) => {
      await requireGovernance(tx, this.actorId);
      const { user, state } = await accessState(tx, targetId);
      if (state !== c.expectedState) throw new StudentError('CONFLICT');
      if (user.role === c.role) throw new StudentError('CONFLICT');
      const before = await getEffectiveRoles(tx, targetId);
      const exists = user.roleAssignments.some((r) => r.role === c.role);
      if (
        c.operation === 'revoke' &&
        c.role === 'ADMIN' &&
        hasRole(before, 'ADMIN')
      ) {
        if (targetId === this.actorId) throw new StudentError('CONFLICT');
        await protectGovernor(tx, this.actorId, targetId);
      }
      if (c.operation === 'grant' && !exists) {
        await tx.userRoleAssignment.create({
          data: { userId: targetId, role: c.role },
        });
        if (c.role === 'ADMIN' && !hasRole(before, 'ADMIN')) {
          await tx.adminAuthorization.upsert({
            where: { userId: targetId },
            create: { userId: targetId },
            update: {
              authority: 'SCOPED',
              permissions: [],
              revision: randomUUID(),
            },
          });
        }
      } else if (c.operation === 'revoke' && exists) {
        await tx.userRoleAssignment.delete({
          where: { userId_role: { userId: targetId, role: c.role } },
        });
        if (
          c.role === 'ADMIN' &&
          !hasRole(await getEffectiveRoles(tx, targetId), 'ADMIN')
        )
          await tx.adminAuthorization.deleteMany({
            where: { userId: targetId },
          });
      }
      await tx.academicAudit.create({
        data: {
          actorId: this.actorId,
          targetId,
          action: 'AdditionalRoleChanged',
          details: {
            role: c.role,
            operation: c.operation,
            changed: c.operation === 'grant' ? !exists : exists,
            reason: c.reason,
            primaryRole: user.role,
          },
        },
      });
    });
  }
  async policy(targetId: string, input: unknown) {
    const c = parseInput(policyChangeInput, input);
    return governanceTransaction(this.db, async (tx) => {
      await requireGovernance(tx, this.actorId);
      if (!hasRole(await getEffectiveRoles(tx, targetId), 'ADMIN'))
        throw new StudentError('FORBIDDEN');
      const { user } = await accessState(tx, targetId),
        before = user.adminAuthorization;
      if ((before?.revision || null) !== c.expectedRevision)
        throw new StudentError('CONFLICT');
      if (!before) {
        if (c.authority !== 'SCOPED') throw new StudentError('CONFLICT');
        await tx.adminAuthorization.create({
          data: {
            userId: targetId,
            authority: 'SCOPED',
            permissions: c.permissions,
          },
        });
        await tx.academicAudit.create({
          data: {
            actorId: this.actorId,
            targetId,
            action: 'AdminPolicyChanged',
            details: {
              beforeAuthority: null,
              afterAuthority: 'SCOPED',
              afterPermissions: c.permissions,
              reason: c.reason,
            },
          },
        });
        return;
      }
      if (before.authority === 'GOVERNANCE' && c.authority !== 'GOVERNANCE')
        await protectGovernor(tx, this.actorId, targetId);
      if (c.authority === 'GOVERNANCE' && before.authority !== 'GOVERNANCE') {
        const identity = (await this.directory.lookup([user.clerkUserId])).get(
          user.clerkUserId,
        );
        if (!identity || identity.status !== 'Active')
          throw new StudentError('CONFLICT');
      }
      const changed = await tx.adminAuthorization.updateMany({
        where: { userId: targetId, revision: before.revision },
        data: {
          authority: c.authority,
          permissions: [...c.permissions].sort(),
          revision: randomUUID(),
        },
      });
      if (changed.count !== 1) throw new StudentError('CONFLICT');
      await tx.academicAudit.create({
        data: {
          actorId: this.actorId,
          targetId,
          action: 'AdminPolicyChanged',
          details: {
            beforeAuthority: before.authority,
            afterAuthority: c.authority,
            beforePermissions: before.permissions,
            afterPermissions: [...c.permissions].sort(),
            reason: c.reason,
          },
        },
      });
    });
  }
}
