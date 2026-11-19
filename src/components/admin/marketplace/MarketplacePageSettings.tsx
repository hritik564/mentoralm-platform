'use client';
import type { AdminProgramPage } from '@/lib/marketplace/page-types';
import { MarketplacePageField as Field } from './MarketplacePageFields';

export type MarketplacePageSettingsInput = Pick<
  AdminProgramPage,
  'eyebrow' | 'heroHeadline' | 'heroSummary' | 'seoTitle' | 'seoDescription'
>;

export function MarketplacePageSettings({
  page,
  disabled,
  busy,
  onSave,
  onCancel,
}: {
  page: AdminProgramPage;
  disabled: boolean;
  busy: boolean;
  onSave: (input: MarketplacePageSettingsInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  return (
    <form
      className="admin-card marketplace-form-section marketplace-page-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const optional = (name: string) =>
          String(form.get(name) || '').trim() || null;
        await onSave({
          eyebrow: optional('eyebrow'),
          heroHeadline: optional('heroHeadline'),
          heroSummary: optional('heroSummary'),
          seoTitle: optional('seoTitle'),
          seoDescription: optional('seoDescription'),
        });
      }}
    >
      <header>
        <h2>Edit page settings</h2>
        <p className="admin-muted">
          Save overrides as a draft, then publish page changes when ready. Leave
          them blank to use the offering’s catalogue details.
        </p>
      </header>
      <fieldset className="marketplace-form-fields" disabled={disabled}>
        <Field
          label="Eyebrow"
          help="An optional short label above the program title."
        >
          <input
            autoFocus
            name="eyebrow"
            maxLength={100}
            defaultValue={page.eyebrow || ''}
          />
        </Field>
        <Field
          label="Hero headline"
          help="Uses the catalogue title when left blank."
        >
          <input
            name="heroHeadline"
            maxLength={200}
            defaultValue={page.heroHeadline || ''}
          />
        </Field>
        <Field
          label="Hero summary"
          help="Uses the catalogue short description when left blank."
        >
          <textarea
            name="heroSummary"
            rows={5}
            maxLength={1200}
            defaultValue={page.heroSummary || ''}
          />
        </Field>
        <div className="marketplace-fields-pair">
          <Field
            label="SEO title"
            help="An optional title for search results and social sharing."
          >
            <input
              name="seoTitle"
              maxLength={160}
              defaultValue={page.seoTitle || ''}
            />
          </Field>
          <Field
            label="SEO description"
            help="Falls back to the hero summary or catalogue description."
          >
            <textarea
              name="seoDescription"
              rows={3}
              maxLength={320}
              defaultValue={page.seoDescription || ''}
            />
          </Field>
        </div>
      </fieldset>
      <p className="marketplace-inline-note">
        The hero image is managed in Catalogue. Leaving it blank uses the
        existing program artwork fallback.
      </p>
      <div className="admin-actions marketplace-page-form-actions">
        <button className="admin-button" type="submit" disabled={disabled}>
          {busy ? 'Saving…' : 'Save Page Draft'}
        </button>
        <button
          className="admin-button secondary"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
