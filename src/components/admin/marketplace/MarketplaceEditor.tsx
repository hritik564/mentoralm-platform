'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminHref } from '@/lib/platform/domains';
import { useAdminData } from '../client';
import { State } from '../Primitives';
import { MarketplaceOfferingForm } from './MarketplaceOfferingForm';
import type { MarketplaceOffering } from './types';

export function MarketplaceEditor({ refId }: { refId?: string }) {
  const router = useRouter();
  const request = useAdminData<MarketplaceOffering>(
    refId ? `marketplace/${refId}` : null,
  );
  return (
    <div className="marketplace-admin">
      <Link className="admin-back" href={adminHref('/admin/marketplace')}>
        ← Back to Marketplace
      </Link>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Marketplace offering</p>
          <h1>
            {refId ? request.data?.title || 'Manage Offering' : 'New Offering'}
          </h1>
          <p>
            {refId
              ? 'Manage catalogue details and publication independently.'
              : 'Start with a draft. Publish when the offering is ready for visitors.'}
          </p>
        </div>
      </div>
      {refId && <State {...request} />}
      {(!refId || request.data) && (
        <MarketplaceOfferingForm
          key={
            request.data
              ? `${request.data.ref}:${request.data.revision}`
              : 'new'
          }
          offering={request.data}
          onSaved={(ref) => {
            if (refId) request.reload();
            else router.push(adminHref(`/admin/marketplace/${ref}`));
          }}
        />
      )}
    </div>
  );
}
