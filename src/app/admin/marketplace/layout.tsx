import 'server-only';
import Link from 'next/link';
import { requireAdminActor } from '@/lib/admin/session';
import { requireAnyAdminPermission } from '@/lib/auth/admin-policy';
import { getDatabase } from '@/lib/db/client';
import { adminHref } from '@/lib/platform/domains';
import { StudentError } from '@/lib/student/errors';
import '@/styles/admin-marketplace.css';

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const actor = await requireAdminActor();
    await requireAnyAdminPermission(getDatabase(), actor.id, [
      'MARKETPLACE_MANAGE',
      'COMMERCE_VIEW',
    ]);
  } catch (error) {
    if (!(error instanceof StudentError) || error.code !== 'FORBIDDEN')
      throw error;
    return (
      <section className="admin-card">
        <h1>Access unavailable</h1>
        <p>Your current Admin permissions do not include Marketplace.</p>
        <Link className="admin-text-link" href={adminHref('/admin')}>
          Return to Overview
        </Link>
      </section>
    );
  }
  return children;
}
