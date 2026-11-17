import 'server-only';
import Link from 'next/link';
import type { AdminWorkspaceId } from '@/lib/admin/navigation';
import { workspacePermissions } from '@/lib/admin/navigation';
import { requireAdminActor } from '@/lib/admin/session';
import { requireAnyAdminPermission } from '@/lib/auth/admin-policy';
import { getDatabase } from '@/lib/db/client';
import { StudentError } from '@/lib/student/errors';
import { adminHref } from '@/lib/platform/domains';
/** Landing-page presentation access only; child services keep their exact existing gates. */
export async function WorkspacePage({
  kind,
  children,
  batchOnly = false,
}: {
  kind: AdminWorkspaceId;
  batchOnly?: boolean;
  children: React.ReactNode;
}) {
  try {
    const actor = await requireAdminActor();
    await requireAnyAdminPermission(
      getDatabase(),
      actor.id,
      batchOnly ? ['BATCHES_MANAGE'] : workspacePermissions(kind),
    );
  } catch (error) {
    if (!(error instanceof StudentError) || error.code !== 'FORBIDDEN')
      throw error;
    return (
      <section className="admin-card">
        <h1>Access unavailable</h1>
        <p>Your current Admin permissions do not include this area.</p>
        <Link className="admin-text-link" href={adminHref('/admin')}>
          Return to Overview
        </Link>
      </section>
    );
  }
  return children;
}
