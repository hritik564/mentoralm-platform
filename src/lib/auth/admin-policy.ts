import 'server-only';
import type { Prisma, AdminPermission } from '../../generated/prisma/client';
import { requireAdmin } from './roles';
import { StudentError } from '../student/errors';
import { adminPermissions } from '../admin/permissions';
export async function adminCapabilities(
  db: Prisma.TransactionClient,
  userId: string,
) {
  await requireAdmin(db, userId);
  const policy = await db.adminAuthorization.findUnique({ where: { userId } });
  return {
    authority: policy?.authority || null,
    permissions:
      policy?.authority === 'GOVERNANCE'
        ? [...adminPermissions]
        : policy?.permissions || [],
  };
}
export async function requireAdminPermission(
  db: Prisma.TransactionClient,
  userId: string,
  permission: AdminPermission,
) {
  const capabilities = await adminCapabilities(db, userId);
  if (!capabilities.permissions.includes(permission))
    throw new StudentError('FORBIDDEN');
  return capabilities;
}
export async function requireGovernance(
  db: Prisma.TransactionClient,
  userId: string,
) {
  const capabilities = await adminCapabilities(db, userId);
  if (capabilities.authority !== 'GOVERNANCE')
    throw new StudentError('FORBIDDEN');
  return capabilities;
}
export async function requireAnyAdminPermission(
  db: Prisma.TransactionClient,
  userId: string,
  permissions: readonly AdminPermission[],
) {
  const c = await adminCapabilities(db, userId);
  if (!permissions.some((p) => c.permissions.includes(p)))
    throw new StudentError('FORBIDDEN');
  return c;
}
