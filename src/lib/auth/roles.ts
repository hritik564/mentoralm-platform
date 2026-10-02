import 'server-only';
import type { Prisma, Role } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';

/** Fresh persisted authority. Primary persona remains separate from effective platform roles. */
export async function getEffectiveRoles(
  db: Prisma.TransactionClient,
  userId: string,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      roleAssignments: { select: { role: true } },
    },
  });
  return user
    ? {
        id: user.id,
        primaryRole: user.role,
        roles: new Set<Role>([
          user.role,
          ...user.roleAssignments.map((a) => a.role),
        ]),
      }
    : null;
}
export function hasRole(
  user: Awaited<ReturnType<typeof getEffectiveRoles>>,
  role: Role,
) {
  return user?.roles.has(role) === true;
}
export async function requireAdmin(
  db: Prisma.TransactionClient,
  userId: string,
) {
  const user = await getEffectiveRoles(db, userId);
  if (!hasRole(user, 'ADMIN')) throw new StudentError('FORBIDDEN');
  return user!;
}
