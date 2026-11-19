import { clerkDirectory } from '@/lib/admin/directory';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminActor } from '@/lib/admin/session';
import { CommerceAdmin } from '@/lib/marketplace/commerce/admin';
import { getDatabase } from '@/lib/db/client';
import { adminHref } from '@/lib/platform/domains';
import { StudentError } from '@/lib/student/errors';
import { programPrice } from '@/components/marketplace/program/presentation';
export const dynamic = 'force-dynamic';
export default async function OrderDetail({
  params,
}: {
  params: Promise<{ orderRef: string }>;
}) {
  const actor = await requireAdminActor();
  let row;
  try {
    row = await new CommerceAdmin(
      getDatabase(),
      actor.id,
      clerkDirectory,
    ).detail((await params).orderRef);
  } catch (e) {
    if (e instanceof StudentError && e.code === 'NOT_FOUND') notFound();
    if (e instanceof StudentError && e.code === 'FORBIDDEN')
      return (
        <section className="admin-card">
          <h1>Access unavailable</h1>
          <p>Your current permissions do not include financial records.</p>
        </section>
      );
    throw e;
  }
  return (
    <section className="admin-card">
      <Link href={adminHref('/admin/marketplace/orders')}>← Orders</Link>
      <p className="admin-eyebrow">Marketplace · Commerce</p>
      <h1>{row.program.title}</h1>
      <p className="commerce-reference">Order {row.ref}</p>
      <dl className="commerce-admin-details">
        <dt>Customer</dt>
        <dd>
          {row.customer.name} · {row.customer.email || 'Email unavailable'}
        </dd>
        <dt>Total</dt>
        <dd>
          {programPrice(row.program)} ({row.program.currency})
        </dd>
        <dt>Order status</dt>
        <dd>{row.status.replaceAll('_', ' ').toLowerCase()}</dd>
        <dt>Payment status</dt>
        <dd>
          {row.paymentStatus?.replaceAll('_', ' ').toLowerCase() ||
            'Not started'}
        </dd>
        <dt>Provider</dt>
        <dd>{row.provider || 'Not assigned'}</dd>
        <dt>Purchased access</dt>
        <dd>{row.entitlementStatus?.toLowerCase() || 'Not granted'}</dd>
        <dt>Created</dt>
        <dd>{new Date(row.createdAt).toISOString()}</dd>
        {row.failureCode && (
          <>
            <dt>Review category</dt>
            <dd>{row.failureCode.replaceAll('_', ' ').toLowerCase()}</dd>
          </>
        )}
      </dl>
      <p>
        Purchased access is separate from learning delivery. Settlement comes
        only from verified provider evidence.
      </p>
      <h2>Commerce activity</h2>
      <ul>
        {row.events.map((event, index) => (
          <li key={index}>
            {event.kind.replace(/([a-z])([A-Z])/g, '$1 $2')} ·{' '}
            <time dateTime={event.createdAt}>
              {new Date(event.createdAt).toISOString()}
            </time>
            {event.safeCode
              ? ` · ${event.safeCode.replaceAll('_', ' ').toLowerCase()}`
              : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
