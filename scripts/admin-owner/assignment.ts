import type { PrismaClient } from '../../src/generated/prisma/client';
import { governanceTransaction } from '../../src/lib/admin/governance/access';
import { StudentError } from '../../src/lib/student/errors';
/** Trusted operator only: no HTTP route imports this module. Production authority is not bootstrapped here. */
export async function changeAdditionalAdmin(
  db: PrismaClient,
  userId: string,
  operation: 'grant' | 'revoke',
) {
  return governanceTransaction(db, async (tx) => {
    const policy = await tx.adminAuthorization.findUnique({
      where: { userId },
    });
    if (operation === 'revoke' && policy?.authority === 'GOVERNANCE')
      throw new StudentError('CONFLICT');
    const effective = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roleAssignments: true },
    });
    const wasAdmin =
      effective.role === 'ADMIN' ||
      effective.roleAssignments.some((a) => a.role === 'ADMIN');
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true, studentId: true },
    });
    const count =
      operation === 'grant'
        ? (
            await tx.userRoleAssignment.createMany({
              data: [{ userId, role: 'ADMIN' }],
              skipDuplicates: true,
            })
          ).count
        : (
            await tx.userRoleAssignment.deleteMany({
              where: { userId, role: 'ADMIN' },
            })
          ).count;
    if (operation === 'grant' && !wasAdmin)
      await tx.adminAuthorization.upsert({
        where: { userId },
        create: { userId },
        update: {
          authority: 'SCOPED',
          permissions: [],
          revision: crypto.randomUUID(),
        },
      });
    if (operation === 'revoke' && effective.role !== 'ADMIN')
      await tx.adminAuthorization.deleteMany({ where: { userId } });
    // Every successful invocation is auditable, including an idempotent no-op.
    await tx.academicAudit.create({
      data: {
        actorId: userId,
        targetId: userId,
        action:
          operation === 'grant'
            ? 'LOCAL_ADMIN_ROLE_GRANTED'
            : 'LOCAL_ADMIN_ROLE_REVOKED',
        details: {
          source: 'local-development-operator',
          role: 'ADMIN',
          primaryRole: user.role,
          changed: count === 1,
          operation,
        },
      },
    });
    return {
      changed: count === 1,
      primaryRole: user.role,
      studentId: user.studentId,
    };
  });
}
