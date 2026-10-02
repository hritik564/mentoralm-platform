import type { PrismaClient } from '../../src/generated/prisma/client';
import { academicTransaction } from '../../src/lib/lms/completion';
/** Trusted operator only: no HTTP route imports this module. Production authority is not bootstrapped here. */
export async function changeAdditionalAdmin(
  db: PrismaClient,
  userId: string,
  operation: 'grant' | 'revoke',
) {
  return academicTransaction(db, async (tx) => {
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
