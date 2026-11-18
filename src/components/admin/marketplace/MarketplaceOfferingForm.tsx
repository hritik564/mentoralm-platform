'use client';
import Link from 'next/link';
import { useState } from 'react';
import { adminHref } from '@/lib/platform/domains';
import { useAdminMutation } from '../client';
import { parseMarketplacePrice } from '@/lib/marketplace/price';
import { MarketplacePublishingActions } from './MarketplacePublishingActions';
import {
  MarketplaceIdentityFields,
  MarketplacePresentationFields,
  MarketplaceCommerceFields,
  MarketplaceDeliveryFields,
  MarketplaceLmsFields,
  MarketplacePlacementFields,
} from './MarketplaceFields';
import type { MarketplaceOffering } from './types';

export function MarketplaceOfferingForm({
  offering,
  onSaved,
}: {
  offering?: MarketplaceOffering;
  onSaved: (ref: string) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [priceError, setPriceError] = useState('');
  const mutation = useAdminMutation(() => {});
  const archived = offering?.publicationStatus === 'ARCHIVED';
  return (
    <div className="marketplace-editor-grid">
      <form
        className="marketplace-offering-form"
        onChange={(event) => {
          if (event.target.name) {
            setDirty(true);
            setPriceError('');
          }
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          let priceMinor: number | null;
          try {
            priceMinor = parseMarketplacePrice(
              String(form.get('price') || ''),
              String(form.get('currency') || ''),
            );
          } catch (error) {
            setPriceError(
              error instanceof Error ? error.message : 'Enter a valid price.',
            );
            return;
          }
          const starts = String(form.get('cohortStartsAt') || '');
          const result = await mutation.save(
            `marketplace${offering ? `/${offering.ref}` : ''}`,
            {
              title: form.get('title'),
              slug: form.get('slug'),
              shortDescription: form.get('shortDescription'),
              category: form.get('category'),
              cardImage: form.get('cardImage') || null,
              heroImage: form.get('heroImage') || null,
              deliveryMode: form.get('deliveryMode'),
              durationLabel: form.get('durationLabel'),
              priceMinor,
              currency: form.get('currency'),
              availabilityStatus: form.get('availabilityStatus'),
              cohortStartsAt: starts ? new Date(starts).toISOString() : null,
              lmsEnabled: form.has('lmsEnabled'),
              courseRef: form.has('lmsEnabled')
                ? form.get('courseRef') || null
                : null,
              featured: form.has('featured'),
              sortOrder: Number(form.get('sortOrder')),
              ...(offering ? { revision: offering.revision } : {}),
            },
          );
          if (result?.ref) {
            setDirty(false);
            onSaved(result.ref);
          }
        }}
      >
        <fieldset
          disabled={archived || mutation.busy}
          className="marketplace-form-fields"
        >
          <MarketplaceIdentityFields offering={offering} />
          <MarketplacePresentationFields offering={offering} />
          <MarketplaceCommerceFields offering={offering} />
          <MarketplaceDeliveryFields offering={offering} />
          <MarketplaceLmsFields offering={offering} />
          <MarketplacePlacementFields offering={offering} />
        </fieldset>
        {!archived && (
          <div className="admin-card marketplace-save-bar">
            <div>
              {priceError && <p role="alert">{priceError}</p>}
              <p role="status">
                {mutation.notice ||
                  (offering
                    ? 'Publication changes are managed separately.'
                    : 'New offerings are saved as drafts.')}
              </p>
              {offering?.publicationStatus === 'PUBLISHED' && (
                <small>Saved catalogue changes are visible to visitors.</small>
              )}
            </div>
            <div className="admin-actions">
              <Link
                className="admin-button secondary"
                href={adminHref('/admin/marketplace')}
              >
                Back to list
              </Link>
              <button
                className="admin-button"
                type="submit"
                disabled={mutation.busy}
              >
                {mutation.busy
                  ? 'Saving…'
                  : offering
                    ? 'Save changes'
                    : 'Save Draft'}
              </button>
            </div>
          </div>
        )}
      </form>
      <aside className="marketplace-editor-aside">
        <MarketplacePublishingActions
          offering={offering}
          disabled={dirty || mutation.busy}
          onSaved={() => {
            if (offering) onSaved(offering.ref);
          }}
        />
        <section className="admin-card marketplace-boundary-card">
          <h2>One offering, its own purpose</h2>
          <p>
            Marketplace controls public catalogue information. Existing LMS
            courses continue to manage learning content.
          </p>
          <p>
            Publishing does not create a purchase, enrollment or access grant.
          </p>
        </section>
      </aside>
    </div>
  );
}
