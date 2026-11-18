'use client';
import { useState } from 'react';
import { useAdminMutation } from '../client';
import { AdminDialog, DateText } from '../Primitives';
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge';
import type { MarketplaceOffering } from './types';

type PublishingAction = 'publish' | 'unpublish' | 'archive';
const actions: Record<
  PublishingAction,
  { label: string; title: string; description: string }
> = {
  publish: {
    label: 'Publish Offering',
    title: 'Publish this offering?',
    description:
      'This offering will appear in the public Marketplace. A featured offering may also appear on the homepage. Availability remains a separate setting.',
  },
  unpublish: {
    label: 'Unpublish Offering',
    title: 'Unpublish this offering?',
    description:
      'This offering will be removed from the public Marketplace and homepage. Its details will be preserved in Admin.',
  },
  archive: {
    label: 'Archive Offering',
    title: 'Archive this offering?',
    description:
      'This offering will be hidden from public views and retained as an archived record.',
  },
};

export function MarketplacePublishingActions({
  offering,
  disabled,
  onSaved,
}: {
  offering?: MarketplaceOffering;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [action, setAction] = useState<PublishingAction | null>(null);
  const mutation = useAdminMutation(onSaved);
  const archived = offering?.publicationStatus === 'ARCHIVED';
  const missing = offering
    ? [
        !offering.shortDescription.trim() ? 'a short description' : '',
        !offering.category.trim() ? 'a category' : '',
        !offering.durationLabel.trim() ? 'a duration' : '',
        offering.lmsEnabled && !offering.courseRef ? 'a linked LMS course' : '',
      ].filter(Boolean)
    : [];
  const needsMetadata =
    offering?.publicationStatus !== 'PUBLISHED' && missing.length > 0;
  return (
    <section
      className="admin-card marketplace-publishing"
      aria-labelledby="marketplace-publishing-title"
    >
      <h2 id="marketplace-publishing-title">Publishing</h2>
      <MarketplaceStatusBadge value={offering?.publicationStatus || 'DRAFT'} />
      <p className="admin-muted">
        {archived
          ? 'This archived offering is preserved and hidden from the public catalogue.'
          : offering?.publicationStatus === 'PUBLISHED'
            ? 'Visible in the public catalogue. Availability controls the status shown to visitors.'
            : 'Hidden from the public catalogue until you explicitly publish it.'}
      </p>
      {offering?.publishedAt && (
        <p className="marketplace-published-date">
          Published <DateText value={offering.publishedAt} />
        </p>
      )}
      {!offering ? (
        <p className="marketplace-publishing-note">
          Save this offering as a draft before publishing.
        </p>
      ) : !archived ? (
        <div className="marketplace-publishing-buttons">
          <button
            type="button"
            className="admin-button"
            disabled={disabled || mutation.busy || needsMetadata}
            onClick={() =>
              setAction(
                offering.publicationStatus === 'PUBLISHED'
                  ? 'unpublish'
                  : 'publish',
              )
            }
          >
            {offering.publicationStatus === 'PUBLISHED'
              ? 'Unpublish Offering'
              : 'Publish Offering'}
          </button>
          <button
            type="button"
            className="admin-danger-button"
            disabled={disabled || mutation.busy}
            onClick={() => setAction('archive')}
          >
            Archive Offering
          </button>
          {disabled && (
            <p className="admin-muted">
              Save your changes before changing publication.
            </p>
          )}
          {needsMetadata && (
            <p className="admin-muted">
              Before publishing, add {missing.join(', ')} and save your changes.
            </p>
          )}
        </div>
      ) : null}
      {!action && mutation.notice && <p role="status">{mutation.notice}</p>}
      {action && offering && (
        <AdminDialog
          title={actions[action].title}
          onClose={() => {
            if (!mutation.busy) setAction(null);
          }}
        >
          <form
            className="admin-form marketplace-publish-confirm"
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await mutation.save(
                `marketplace/${offering.ref}/${action}`,
                { revision: offering.revision },
              );
              if (result) setAction(null);
            }}
          >
            <p>{actions[action].description}</p>
            <label className="admin-check">
              <input type="checkbox" required /> I confirm this publication
              change.
            </label>
            <p role="status">{mutation.notice}</p>
            <div className="admin-actions">
              <button
                className={
                  action === 'archive' ? 'admin-danger-button' : 'admin-button'
                }
                type="submit"
                disabled={mutation.busy}
              >
                {mutation.busy ? 'Updating…' : actions[action].label}
              </button>
              <button
                className="admin-button secondary"
                type="button"
                disabled={mutation.busy}
                onClick={() => setAction(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminDialog>
      )}
    </section>
  );
}
