'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminHref } from '@/lib/platform/domains';
import { AdminIcon } from '../AdminIcon';
import { useAdminData } from '../client';
import { DateText, Pager, State, Table } from '../Primitives';
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge';
import { marketplaceLabel, marketplacePrice } from './format';
import { publicationStatuses, type MarketplaceOfferingList } from './types';

export function MarketplaceList() {
  const search = useSearchParams(),
    router = useRouter();
  const status =
    publicationStatuses.find((value) => value === search.get('status')) || '';
  const query = search.get('q') || '';
  const rawPage = Number(search.get('page') || '1');
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const params = new URLSearchParams({
    page: String(page),
    ...(status ? { status } : {}),
    ...(query ? { q: query } : {}),
  });
  const request = useAdminData<MarketplaceOfferingList>(
    `marketplace?${params}`,
  );
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`${adminHref('/admin/marketplace')}?${next}`);
  }
  return (
    <div className="marketplace-admin">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Public catalogue</p>
          <h1>Marketplace</h1>
          <p>
            Create and publish the courses, programs and services people
            discover.
          </p>
        </div>
        <Link
          className="admin-button"
          href={adminHref('/admin/marketplace/new')}
        >
          <AdminIcon name="plus" /> New Offering
        </Link>
      </div>
      <div className="marketplace-admin-context">
        <AdminIcon name="courses" />
        <p>
          Marketplace offerings describe what you offer. Link an existing LMS
          course when learning delivery needs it.
        </p>
      </div>
      <section className="admin-card admin-list-card">
        <nav
          className="marketplace-status-tabs"
          aria-label="Offering publication status"
        >
          {['', ...publicationStatuses].map((value) => (
            <button
              key={value || 'all'}
              type="button"
              aria-pressed={status === value}
              onClick={() => update({ status: value, page: '1' })}
            >
              {value ? marketplaceLabel(value) : 'All'}
            </button>
          ))}
        </nav>
        <form
          className="admin-filters"
          onSubmit={(event) => {
            event.preventDefault();
            update({
              q: String(new FormData(event.currentTarget).get('q') || ''),
              page: '1',
            });
          }}
        >
          <label className="admin-search-field">
            <span className="sr-only">Search marketplace offerings</span>
            <input
              key={query}
              name="q"
              defaultValue={query}
              maxLength={100}
              placeholder="Search title or slug…"
            />
          </label>
          <button className="admin-button secondary" type="submit">
            Search
          </button>
        </form>
        <State {...request} />
        {request.data && (
          <>
            {request.data.rows.length ? (
              <Table
                caption="Marketplace offerings"
                headers={[
                  'Offering',
                  'Publication',
                  'Availability',
                  'Price',
                  'LMS',
                  'Featured',
                  'Updated',
                  'Action',
                ]}
              >
                {request.data.rows.map((offering) => (
                  <tr key={offering.ref}>
                    <td className="marketplace-offering-title">
                      <Link
                        className="admin-row-link"
                        href={adminHref(`/admin/marketplace/${offering.ref}`)}
                      >
                        {offering.title}
                      </Link>
                      <small>{offering.slug}</small>
                    </td>
                    <td>
                      <MarketplaceStatusBadge
                        value={offering.publicationStatus}
                      />
                    </td>
                    <td>
                      <MarketplaceStatusBadge
                        value={offering.availabilityStatus}
                      />
                    </td>
                    <td>
                      {marketplacePrice(offering.priceMinor, offering.currency)}
                    </td>
                    <td>{offering.lmsEnabled ? 'Enabled' : 'Not enabled'}</td>
                    <td>{offering.featured ? 'Featured' : '—'}</td>
                    <td>
                      <DateText value={offering.updatedAt} />
                    </td>
                    <td>
                      <Link
                        className="admin-text-link"
                        href={adminHref(`/admin/marketplace/${offering.ref}`)}
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <div className="marketplace-admin-empty">
                <span className="admin-action-icon">
                  <AdminIcon name="courses" />
                </span>
                <h2>
                  {status || query
                    ? 'No offerings match this view'
                    : 'No marketplace offerings yet'}
                </h2>
                <p>
                  {status || query
                    ? 'Try a different status or search term.'
                    : 'Create your first offering, then publish it when the catalogue details are ready.'}
                </p>
                <Link
                  className="admin-button secondary"
                  href={adminHref('/admin/marketplace/new')}
                >
                  {status || query
                    ? 'New Offering'
                    : 'Create your first offering'}
                </Link>
              </div>
            )}
            <Pager
              page={request.data.page}
              total={request.data.total}
              onPage={(next) => update({ page: String(next) })}
            />
          </>
        )}
      </section>
    </div>
  );
}
