'use client';
import { useRef, useState } from 'react';
import { adminRequest, useAdminData } from '../client';
import { Pill, State } from '../Primitives';
import type {
  AdminProgramPage,
  AdminProgramSection,
} from '@/lib/marketplace/page-types';
import type { MarketplaceOffering } from './types';
import { MarketplacePageSettings } from './MarketplacePageSettings';
import { MarketplaceSectionEditor } from './MarketplaceSectionEditor';
import { sectionLabels } from './MarketplacePageFields';

const editorialStates: Record<
  AdminProgramPage['editorialStatus'],
  { label: string; description: string }
> = {
  NO_PUBLISHED_CONTENT: {
    label: 'No published custom content',
    description:
      'No custom page content has been published. A Published offering uses the basic catalogue page.',
  },
  DRAFT_CHANGES: {
    label: 'Draft changes',
    description:
      'Your custom content is saved as a draft. Publishing the offering alone keeps the basic catalogue page.',
  },
  PUBLISHED: {
    label: 'Published',
    description: 'The draft matches the latest published custom content.',
  },
  DRAFT_CHANGES_SINCE_PUBLISH: {
    label: 'Draft changes since last publish',
    description:
      'Your saved draft has changes. The last published custom content is retained for visitors.',
  },
};

function sectionSummary(section: AdminProgramSection) {
  const content = section.content;
  if ('body' in content)
    return content.body.trim() ? 'Text content' : 'No text added';
  if ('modules' in content)
    return `${content.modules.length} ${content.modules.length === 1 ? 'module' : 'modules'}`;
  const noun = section.type === 'FAQ' ? 'question' : 'item';
  return `${content.items.length} ${noun}${content.items.length === 1 ? '' : 's'}`;
}

export function MarketplacePageEditor({
  offering,
}: {
  offering: MarketplaceOffering;
}) {
  const base = `marketplace/${offering.ref}/page`;
  const request = useAdminData<AdminProgramPage>(base);
  const [saved, setSaved] = useState<AdminProgramPage>();
  const returnFocus = useRef<HTMLElement | null>(null);
  function beginEditing(next: typeof editing) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setFeedback(null);
    setEditing(next);
  }
  function closeEditor() {
    setEditing(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }
  const [editing, setEditing] = useState<
    'settings' | 'new' | { ref: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const page = saved || request.data;
  const archived = offering.publicationStatus === 'ARCHIVED';
  const unavailable = request.loading || !!request.error;
  const disabled = busy || archived || unavailable;
  const viewDisabled = busy || unavailable || editing !== null;
  const listDisabled = disabled || editing !== null;
  const currentSection =
    typeof editing === 'object' && editing !== null
      ? page?.sections.find((section) => section.ref === editing.ref)
      : undefined;
  function reload() {
    setSaved(undefined);
    setEditing(null);
    setFeedback(null);
    request.reload();
  }
  async function save(path: string, body: unknown, notice: string) {
    setBusy(true);
    setPublishing(path === 'publish');
    setFeedback(null);
    try {
      if (new Blob([JSON.stringify(body)]).size > 65536) {
        throw new Error(
          'This section is too long to save at once. Shorten its content or split it into smaller sections.',
        );
      }
      const updated = await adminRequest<AdminProgramPage>(
        `${base}/${path}`,
        body,
      );
      setSaved(updated);
      if (editing !== null) closeEditor();
      setFeedback({ text: notice, error: false });
      return true;
    } catch (error) {
      setFeedback({
        text:
          error instanceof Error
            ? error.message
            : 'Unable to save page content.',
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
      setPublishing(false);
    }
  }
  async function move(index: number, direction: -1 | 1) {
    if (!page) return;
    const refs = page.sections.map((section) => section.ref);
    const target = index + direction;
    if (target < 0 || target >= refs.length) return;
    [refs[index], refs[target]] = [refs[target], refs[index]];
    await save(
      'reorder',
      { revision: page.revision, sectionRefs: refs },
      'Draft section order saved.',
    );
  }
  return (
    <div className="marketplace-page-editor">
      <section className="admin-card marketplace-page-intro">
        <div>
          <h2>Program page</h2>
          <p>
            Build and review draft page content before publishing it to
            visitors.
          </p>
        </div>
        <p className="marketplace-inline-note">
          This curriculum describes the program for visitors. Learning content
          stays in the existing LMS course.
        </p>
        {archived && (
          <p role="status">
            This archived offering’s page content is preserved and read-only.
          </p>
        )}
        {offering.publicationStatus === 'PUBLISHED' && (
          <p className="admin-muted">
            Saving a page draft leaves the current public page unchanged.
          </p>
        )}
      </section>
      <State {...request} reload={reload} />
      {page && (
        <>
          <section
            className="admin-card marketplace-editorial-state"
            aria-labelledby="marketplace-page-publishing-title"
          >
            <header className="marketplace-editorial-heading">
              <div>
                <h2 id="marketplace-page-publishing-title">Page publishing</h2>
                <div role="status">
                  <Pill
                    tone={
                      page.editorialStatus === 'PUBLISHED' ? 'good' : 'neutral'
                    }
                  >
                    {editorialStates[page.editorialStatus].label}
                  </Pill>
                </div>
              </div>
              <button
                className="admin-button"
                type="button"
                disabled={
                  listDisabled || !page.hasDraftChanges || !page.revision
                }
                onClick={() =>
                  save(
                    'publish',
                    { revision: page.revision },
                    'Page changes published.',
                  )
                }
              >
                {publishing ? 'Publishing…' : 'Publish Page Changes'}
              </button>
            </header>
            <p>{editorialStates[page.editorialStatus].description}</p>
            <p>
              {offering.publicationStatus === 'PUBLISHED'
                ? 'The offering is Published. Visitors see the latest explicitly published page content, or the basic catalogue page.'
                : archived
                  ? 'The offering is Archived and unavailable publicly. Its editorial history is preserved.'
                  : `The offering is ${offering.publicationStatus === 'DRAFT' ? 'Draft' : 'Unpublished'}. Published page content stays private until the offering is Published.`}
            </p>
            {page.publishedAt && (
              <p>
                Last page publish:{' '}
                <time dateTime={page.publishedAt}>
                  {new Date(page.publishedAt).toLocaleString('en-GB', {
                    timeZone: 'UTC',
                  })}{' '}
                  UTC
                </time>
              </p>
            )}
            <p className="marketplace-inline-note">
              Only Publish Page Changes updates the public custom content.
              Offering publication continues to control public access.
            </p>
            {editing !== null && !archived && (
              <p>
                Save or cancel the open editor before publishing page changes.
              </p>
            )}
          </section>
          {editing === 'settings' ? (
            <MarketplacePageSettings
              page={page}
              disabled={disabled}
              busy={busy}
              onCancel={closeEditor}
              onSave={(input) =>
                save(
                  'settings',
                  { ...input, revision: page.revision },
                  'Page draft saved.',
                )
              }
            />
          ) : (
            <section className="admin-card marketplace-page-settings-summary">
              <div>
                <h2>Page settings</h2>
                <p className="admin-muted">
                  Draft hero copy and search previews. Catalogue details provide
                  the defaults.
                </p>
                <p>
                  <strong>{page.heroHeadline || offering.title}</strong>
                </p>
                <p className="admin-muted">
                  {page.heroSummary ||
                    offering.shortDescription ||
                    'No summary added yet.'}
                </p>
                <p className="marketplace-inline-note">
                  Hero image: managed in Catalogue.
                </p>
              </div>
              <button
                className="admin-button secondary"
                type="button"
                disabled={viewDisabled}
                onClick={() => beginEditing('settings')}
              >
                {archived ? 'View page settings' : 'Edit page settings'}
              </button>
            </section>
          )}
          <section className="admin-card marketplace-page-sections">
            <header className="marketplace-page-section-heading">
              <div>
                <h2>Page sections</h2>
                <p className="admin-muted">
                  Edit the draft order and visibility here, then publish page
                  changes to update the public sections. Disabled sections
                  retain their content in Admin.
                </p>
              </div>
              <button
                className="admin-button"
                type="button"
                disabled={listDisabled || page.sections.length >= 20}
                onClick={() => beginEditing('new')}
              >
                Add section
              </button>
            </header>
            {page.sections.length === 0 ? (
              <p className="admin-muted marketplace-page-empty">
                No custom sections in this draft yet. Catalogue details provide
                the basic program page.
              </p>
            ) : (
              <ol className="marketplace-section-list">
                {page.sections.map((section, index) => (
                  <li key={section.ref}>
                    <div className="marketplace-section-description">
                      <div className="marketplace-section-label">
                        <span>{sectionLabels[section.type]}</span>
                        <Pill tone={section.enabled ? 'good' : 'neutral'}>
                          {section.enabled ? 'Enabled' : 'Disabled'}
                        </Pill>
                      </div>
                      <h3>{section.title}</h3>
                      {section.subtitle && <p>{section.subtitle}</p>}
                      <small>{sectionSummary(section)}</small>
                    </div>
                    <div className="marketplace-section-controls">
                      <button
                        className="admin-button secondary"
                        type="button"
                        disabled={viewDisabled}
                        aria-label={`${archived ? 'View' : 'Edit'} ${section.title}`}
                        onClick={() => beginEditing({ ref: section.ref })}
                      >
                        {archived ? 'View section' : 'Edit section'}
                      </button>
                      <button
                        className="admin-button secondary"
                        type="button"
                        disabled={listDisabled}
                        aria-label={`${section.enabled ? 'Disable' : 'Enable'} ${section.title}`}
                        onClick={() =>
                          save(
                            `sections/${section.ref}/enabled`,
                            {
                              revision: page.revision,
                              enabled: !section.enabled,
                            },
                            section.enabled
                              ? 'Section disabled in draft.'
                              : 'Section enabled in draft.',
                          )
                        }
                      >
                        {section.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <div className="marketplace-section-order">
                        <button
                          className="admin-button secondary"
                          type="button"
                          disabled={listDisabled || index === 0}
                          aria-label={`Move ${section.title} up`}
                          onClick={() => move(index, -1)}
                        >
                          Move up
                        </button>
                        <button
                          className="admin-button secondary"
                          type="button"
                          disabled={
                            listDisabled || index === page.sections.length - 1
                          }
                          aria-label={`Move ${section.title} down`}
                          onClick={() => move(index, 1)}
                        >
                          Move down
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="marketplace-inline-note">
              {page.sections.length} of 20 draft sections. Empty sections stay
              hidden when page changes are published.
            </p>
          </section>
          {(editing === 'new' || currentSection) && (
            <MarketplaceSectionEditor
              key={currentSection?.ref || 'new'}
              section={currentSection}
              disabled={disabled}
              busy={busy}
              onCancel={closeEditor}
              onSave={(input) =>
                save(
                  currentSection
                    ? `sections/${currentSection.ref}`
                    : 'sections',
                  { ...input, revision: page.revision },
                  'Section draft saved.',
                )
              }
            />
          )}
        </>
      )}
      {feedback && (
        <div
          className={`admin-card marketplace-page-feedback${feedback.error ? ' is-error' : ''}`}
        >
          <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>
          {feedback.error && (
            <button
              className="admin-button secondary"
              type="button"
              disabled={busy}
              onClick={reload}
            >
              Reload page content
            </button>
          )}
        </div>
      )}
    </div>
  );
}
