'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminHref } from '@/lib/platform/domains';
import { useAdminData } from '../client';
import { State } from '../Primitives';
import { MarketplaceOfferingForm } from './MarketplaceOfferingForm';
import { MarketplacePageEditor } from './MarketplacePageEditor';
import type { MarketplaceOffering } from './types';

export function MarketplaceEditor({ refId }: { refId?: string }) {
  const router = useRouter();
  const [view, setView] = useState<'catalogue' | 'page'>('catalogue');
  const [pageVisited, setPageVisited] = useState(false);
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
              ? 'Manage catalogue details, program content and publication.'
              : 'Start with a draft. Publish when the offering is ready for visitors.'}
          </p>
        </div>
      </div>
      <div
        className="marketplace-editor-tabs"
        role="group"
        aria-label="Offering editor"
      >
        <button
          type="button"
          aria-pressed={view === 'catalogue'}
          onClick={() => setView('catalogue')}
        >
          Catalogue
        </button>
        <button
          type="button"
          aria-pressed={view === 'page'}
          disabled={!request.data}
          onClick={() => {
            setPageVisited(true);
            setView('page');
          }}
        >
          Program page
        </button>
      </div>
      {!refId && (
        <p className="marketplace-editor-tab-note">
          Save the offering as a draft before adding its program page.
        </p>
      )}
      {refId && <State {...request} />}
      {(!refId || request.data) && (
        <div hidden={view !== 'catalogue'}>
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
        </div>
      )}
      {pageVisited && request.data && (
        <div hidden={view !== 'page'}>
          <MarketplacePageEditor
            key={request.data.ref}
            offering={request.data}
          />
        </div>
      )}
    </div>
  );
}
