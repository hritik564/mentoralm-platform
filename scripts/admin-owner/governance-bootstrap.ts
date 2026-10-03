import 'server-only';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { randomUUID } from 'node:crypto';
import { governanceTransaction } from '../../src/lib/admin/governance/access';
import { getEffectiveRoles, hasRole } from '../../src/lib/auth/roles';
import { StudentError } from '../../src/lib/student/errors';
/** Explicit trusted operator bootstrap; not imported by an HTTP route. */
export async function bootstrapGovernance(db: PrismaClient, userId: string) {
  return governanceTransaction(db, async (tx) => {
    if (!hasRole(await getEffectiveRoles(tx, userId), 'ADMIN'))
      throw new StudentError('FORBIDDEN');
    const before = await tx.adminAuthorization.findUnique({
      where: { userId },
    });
    if (!before) throw new StudentError('CONFLICT');
    const governors = await tx.adminAuthorization.findMany({
      where: {
        authority: 'GOVERNANCE',
        user: {
          OR: [
            { role: 'ADMIN' },
            { roleAssignments: { some: { role: 'ADMIN' } } },
          ],
        },
      },
      select: { userId: true },
    });
    if (governors.some((g) => g.userId !== userId))
      throw new StudentError('CONFLICT');
    const changed = before.authority !== 'GOVERNANCE';
    if (changed)
      await tx.adminAuthorization.update({
        where: { userId },
        data: {
          authority: 'GOVERNANCE',
          permissions: [],
          revision: randomUUID(),
        },
      });
    await tx.academicAudit.create({
      data: {
        actorId: userId,
        targetId: userId,
        action: 'LOCAL_GOVERNANCE_BOOTSTRAP',
        details: {
          source: 'local-development-operator',
          beforeAuthority: before.authority,
          afterAuthority: 'GOVERNANCE',
          changed,
        },
      },
    });
    return { changed };
  });
}
