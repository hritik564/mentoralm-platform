'use client';
import { useState } from 'react';
import { useAdminMutation } from '../client';
import { Field, FormActions, Notice } from './forms';
import type { ItemDetail } from './types';
import { safeLessonContent, type LessonContent } from '@/lib/lms/content';
type Block = LessonContent['blocks'][number];
const empty: Block = { type: 'paragraph', text: '' };
export function LessonEditor({
  item,
  path,
  onSaved,
}: {
  item: ItemDetail;
  path: string;
  onSaved: () => void;
}) {
  const l = item.lesson,
    [format, setFormat] = useState(l?.format || 'TEXT'),
    [blocks, setBlocks] = useState<Block[]>(
      safeLessonContent(l?.structuredContent)?.blocks || [empty],
    ),
    mutation = useAdminMutation(onSaved);
  function change(n: number, next: Block) {
    setBlocks((old) => old.map((b, i) => (i === n ? next : b)));
  }
  return (
    <section className="academic-editor-panel">
      <h3>Lesson content</h3>
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const body =
            format === 'TEXT'
              ? {
                  format,
                  structuredContent: { version: 1, blocks },
                  durationSeconds:
                    f.get('duration') !== '' ? Number(f.get('duration')) : null,
                }
              : format === 'EXTERNAL'
                ? { format, externalTargetId: f.get('external') }
                : {
                    format,
                    downloadAllowed: f.has('download'),
                    altText: f.get('alt') || null,
                    durationSeconds:
                      f.get('duration') !== ''
                        ? Number(f.get('duration'))
                        : null,
                  };
          await mutation.save(`${path}/lesson`, body);
        }}
      >
        <Field label="Lesson format">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
          >
            {['TEXT', 'VIDEO', 'PDF', 'IMAGE', 'EXTERNAL'].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        {format === 'TEXT' ? (
          <>
            <p className="admin-muted">
              Structured, safely escaped content. No HTML or embedded frames.
            </p>
            <div className="academic-blocks">
              {blocks.map((b, n) => (
                <fieldset key={n} className="academic-block">
                  <legend>Block {n + 1}</legend>
                  <Field label={`Block ${n + 1} type`}>
                    <select
                      value={b.type}
                      onChange={(e) => {
                        const t = e.target.value as Block['type'];
                        change(
                          n,
                          t === 'divider'
                            ? { type: t }
                            : t === 'list'
                              ? { type: t, items: [''], ordered: false }
                              : t === 'heading'
                                ? { type: t, text: '', level: 2 }
                                : { type: t, text: '' },
                        );
                      }}
                    >
                      {[
                        'heading',
                        'paragraph',
                        'list',
                        'callout',
                        'code',
                        'divider',
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  {b.type === 'list' ? (
                    <>
                      <Field label={`Block ${n + 1} list items (one per line)`}>
                        <textarea
                          required
                          value={b.items.join('\n')}
                          onChange={(e) =>
                            change(n, {
                              ...b,
                              items: e.target.value.split('\n'),
                            })
                          }
                        />
                      </Field>
                      <label className="academic-check">
                        <input
                          type="checkbox"
                          checked={b.ordered || false}
                          onChange={(e) =>
                            change(n, { ...b, ordered: e.target.checked })
                          }
                        />{' '}
                        Numbered list
                      </label>
                    </>
                  ) : b.type !== 'divider' ? (
                    <Field label={`Block ${n + 1} text`}>
                      <textarea
                        required
                        maxLength={12000}
                        value={b.text}
                        onChange={(e) =>
                          change(n, { ...b, text: e.target.value })
                        }
                      />
                    </Field>
                  ) : null}
                  {b.type === 'heading' && (
                    <Field label={`Block ${n + 1} heading level`}>
                      <select
                        value={b.level}
                        onChange={(e) =>
                          change(n, {
                            ...b,
                            level: Number(e.target.value) as 2 | 3,
                          })
                        }
                      >
                        <option value={2}>Heading 2</option>
                        <option value={3}>Heading 3</option>
                      </select>
                    </Field>
                  )}
                  <div className="academic-actions">
                    <button
                      type="button"
                      className="admin-button secondary"
                      disabled={n === 0}
                      aria-label={`Move block ${n + 1} up`}
                      onClick={() =>
                        setBlocks((old) => {
                          const a = [...old];
                          [a[n - 1], a[n]] = [a[n], a[n - 1]];
                          return a;
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="admin-button secondary"
                      disabled={n === blocks.length - 1}
                      aria-label={`Move block ${n + 1} down`}
                      onClick={() =>
                        setBlocks((old) => {
                          const a = [...old];
                          [a[n + 1], a[n]] = [a[n], a[n + 1]];
                          return a;
                        })
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="admin-button secondary"
                      disabled={blocks.length === 1}
                      onClick={() =>
                        setBlocks((old) => old.filter((_, i) => i !== n))
                      }
                    >
                      Remove block
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>
            <button
              className="admin-button secondary"
              type="button"
              disabled={blocks.length >= 30}
              onClick={() => setBlocks((old) => [...old, empty])}
            >
              Add content block
            </button>
          </>
        ) : format === 'EXTERNAL' ? (
          <>
            <Field label="Approved external destination">
              <select
                name="external"
                defaultValue={l?.externalTargetId || ''}
                required
              >
                <option value="">Select approved target</option>
                {item.externalTargets.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <p className="admin-muted">
              Destinations come from the server-maintained LMS registry.
              Arbitrary URLs and iframes are not accepted.
            </p>
          </>
        ) : (
          <>
            <p className="admin-muted">
              Save the format first, then attach a private file below. Unpublish
              before attachment/replacement. A format switch cannot orphan an
              existing asset.
            </p>
            <label className="academic-check">
              <input
                name="download"
                type="checkbox"
                defaultChecked={l?.downloadAllowed || false}
              />{' '}
              Allow authorized download
            </label>
            {format === 'IMAGE' && (
              <Field label="Image alternative text">
                <input
                  name="alt"
                  required
                  maxLength={160}
                  defaultValue={l?.altText || ''}
                />
              </Field>
            )}
          </>
        )}
        {format !== 'EXTERNAL' && (
          <Field label="Duration in seconds (optional)">
            <input
              name="duration"
              type="number"
              min={0}
              max={86400}
              defaultValue={l?.durationSeconds ?? ''}
            />
          </Field>
        )}
        <FormActions busy={mutation.busy} notice={mutation.notice} />
      </form>
      {l && ['VIDEO', 'PDF', 'IMAGE'].includes(l.format) && (
        <MediaAttachment item={item} path={path} onSaved={onSaved} />
      )}
    </section>
  );
}
export function MediaAttachment({
  item,
  path,
  onSaved,
}: {
  item: ItemDetail;
  path: string;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const record = item.type === 'RESOURCE' ? item.resource : item.lesson,
    format = item.lesson?.format;
  const accept =
    item.type === 'RESOURCE'
      ? '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt'
      : format === 'VIDEO'
        ? '.mp4,.webm'
        : format === 'PDF'
          ? '.pdf'
          : '.png,.jpg,.jpeg,.webp,.gif';
  return (
    <section className="academic-media">
      <h3>Private attachment</h3>
      <p>
        {record?.fileName
          ? `Attached: ${record.fileName} (${record.mimeType})`
          : 'No file attached.'}
      </p>
      <p className="admin-muted">
        Private local storage: PDF/images/text up to 25 MB; lesson video up to
        50 MB. File bytes stay outside PostgreSQL. Production video streaming
        remains infrastructure work.
      </p>
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setNotice('');
          const f = new FormData(e.currentTarget);
          try {
            const r = await fetch(`/api/admin/${path}/media`, {
              method: 'POST',
              body: f,
            });
            const result = await r.json();
            if (!r.ok) throw Error(result.error);
            setNotice('Private file attached.');
            onSaved();
          } catch (error) {
            setNotice(
              error instanceof Error ? error.message : 'Attachment failed.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Academic file">
          <input
            name="file"
            type="file"
            required
            accept={accept}
            disabled={item.published || !item.mediaAvailable || busy}
          />
        </Field>
        <Notice message={notice} />
        <button
          className="admin-button secondary"
          disabled={item.published || !item.mediaAvailable || busy}
        >
          {busy
            ? 'Attaching…'
            : record?.attached
              ? 'Replace private attachment'
              : 'Attach private file'}
        </button>
        {!item.mediaAvailable && (
          <p>Private storage is not configured. Attachment is unavailable.</p>
        )}
        {item.published && (
          <p>Unpublish this item before replacing its private attachment.</p>
        )}
      </form>
    </section>
  );
}
export function ResourceEditor({
  item,
  path,
  onSaved,
}: {
  item: ItemDetail;
  path: string;
  onSaved: () => void;
}) {
  const mutation = useAdminMutation(onSaved);
  return (
    <section className="academic-editor-panel">
      <h3>LMS learning resource</h3>
      <p className="admin-muted">
        This attaches an academic resource to this Section. Dashboard-only
        student Resources are separate.
      </p>
      <MediaAttachment item={item} path={path} onSaved={onSaved} />
      {item.resource && (
        <form
          className="admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await mutation.save(`${path}/resource`, {
              description: f.get('description') || null,
              downloadAllowed: f.has('download'),
            });
          }}
        >
          <Field label="Resource description">
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={item.resource.description || ''}
            />
          </Field>
          <label className="academic-check">
            <input
              name="download"
              type="checkbox"
              defaultChecked={item.resource.downloadAllowed}
            />{' '}
            Allow authorized download
          </label>
          <FormActions busy={mutation.busy} notice={mutation.notice} />
        </form>
      )}
    </section>
  );
}
