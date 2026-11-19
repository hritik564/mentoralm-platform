import { clerkDirectory } from '@/lib/admin/directory';
import Link from 'next/link';
import { requireAdminActor } from '@/lib/admin/session';
import { CommerceAdmin } from '@/lib/marketplace/commerce/admin';
import { getDatabase } from '@/lib/db/client';
import { adminHref } from '@/lib/platform/domains';
import { StudentError } from '@/lib/student/errors';
import { programPrice } from '@/components/marketplace/program/presentation';
export const dynamic = 'force-dynamic';
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  let result;
  try {
    const actor = await requireAdminActor();
    result = await new CommerceAdmin(
      getDatabase(),
      actor.id,
      clerkDirectory,
    ).list(Number((await searchParams).page || 1));
  } catch (error) {
    if (error instanceof StudentError && error.code === 'FORBIDDEN')
      return (
        <section className="admin-card">
          <h1>Access unavailable</h1>
          <p>Your current permissions do not include financial records.</p>
        </section>
      );
    throw error;
  }
  return (
    <section className="admin-card">
      <p className="admin-eyebrow">Marketplace · Commerce</p>
      <h1>Orders</h1>
      <p>
        Verified payment status and purchased access. Financial access is
        separate from catalogue editing.
      </p>
      {result.items.length ? (
        <div className="commerce-table-scroll">
          <table className="commerce-table">
            <thead>
              <tr>
                <th scope="col">Program / order</th>
                <th scope="col">Customer</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.ref}>
                  <td>
                    <Link
                      href={adminHref(`/admin/marketplace/orders/${row.ref}`)}
                    >
                      {row.program.title}
                    </Link>
                    <small>{row.ref.slice(0, 12)}…</small>
                  </td>
                  <td>
                    {row.customer.name}
                    <small>{row.customer.email}</small>
                  </td>
                  <td>{programPrice(row.program)}</td>
                  <td>
                    {row.status.replaceAll('_', ' ').toLowerCase()}
                    <small>
                      {row.paymentStatus?.replaceAll('_', ' ').toLowerCase() ||
                        'No payment attempt'}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          No orders yet. Orders will appear after customers complete enrollment
          and acknowledge approved purchase terms.
        </p>
      )}
      <nav aria-label="Order pages">
        {result.page > 1 && (
          <Link
            href={`${adminHref('/admin/marketplace/orders')}?page=${result.page - 1}`}
          >
            Previous
          </Link>
        )}
        {result.hasNext && (
          <Link
            href={`${adminHref('/admin/marketplace/orders')}?page=${result.page + 1}`}
          >
            Next
          </Link>
        )}
      </nav>
    </section>
  );
}
