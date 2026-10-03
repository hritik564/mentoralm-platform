'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminData, useAdminMutation, adminRequest } from '../client';
import { Field, FormActions, Notice } from '../academic/forms';
import { Pager, Pill, Table } from '../Primitives';
import { OperationalFrame } from './Frame';
import { adminHref } from '@/lib/platform/domains';
import type { Message } from './types';
import type { BatchList } from '../types';
export function CommunicationCompose() {
  const [query, setQuery] = useState(''),
    [preview, setPreview] = useState<{
      total: number;
      pendingProvider: number;
      suppressed: number;
    } | null>(null),
    [notice, setNotice] = useState(''),
    [previewBusy, setPreviewBusy] = useState(false),
    form = useRef<HTMLFormElement>(null),
    batches = useAdminData<BatchList>(`batches?q=${encodeURIComponent(query)}`),
    router = useRouter(),
    mutation = useAdminMutation(() => {});
  const audience = () => {
    const f = new FormData(form.current!);
    return {
      batchId: f.get('batch'),
      channel: f.get('channel'),
      purpose: f.get('purpose'),
    };
  };
  return (
    <>
      <h1>Plan Batch communication</h1>
      <section className="admin-card ops-detail">
        <p>
          Server-resolved Batch audience and separate channel/purpose
          permissions. Missing permission is suppressed. No EMAIL, WHATSAPP or
          IN_APP sending provider is configured.
        </p>
        <form
          ref={form}
          className="admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              r = await mutation.save('operations/communications/plan', {
                ...audience(),
                subject: f.get('subject'),
                body: f.get('body'),
              });
            if (r?.ref)
              router.push(adminHref(`/admin/communications/${r.ref}`));
          }}
        >
          <Field label="Find Batch">
            <input
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label="Batch audience">
            <select name="batch" required onChange={() => setPreview(null)}>
              <option value="">Select Batch</option>
              {batches.data?.rows.map((b) => (
                <option key={b.ref} value={b.ref}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="academic-form-grid">
            <Field label="Channel">
              <select name="channel" onChange={() => setPreview(null)}>
                {['EMAIL', 'WHATSAPP', 'IN_APP'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Purpose">
              <select name="purpose" onChange={() => setPreview(null)}>
                {['OPERATIONAL', 'MARKETING'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <button
            type="button"
            className="admin-button secondary"
            disabled={previewBusy || mutation.busy}
            onClick={async () => {
              setPreviewBusy(true);
              setNotice('');
              try {
                setPreview(
                  await adminRequest(
                    'operations/communications/audience',
                    audience(),
                  ),
                );
              } catch (e) {
                setNotice(
                  e instanceof Error ? e.message : 'Preview unavailable',
                );
              } finally {
                setPreviewBusy(false);
              }
            }}
          >
            Preview resolved audience
          </button>
          <Notice message={notice} />
          {preview && (
            <p role="status">
              {preview.total} members · {preview.pendingProvider}{' '}
              PENDING_PROVIDER · {preview.suppressed} SUPPRESSED. Permissions
              are checked again when planning.
            </p>
          )}
          <Field label="Subject">
            <input name="subject" required maxLength={160} />
          </Field>
          <Field label="Communication body">
            <textarea name="body" required maxLength={6000} />
          </Field>
          <p className="admin-muted">
            Saving creates auditable delivery plans only. Membership or
            Enrollment never supplies marketing consent.
          </p>
          <FormActions busy={mutation.busy} notice={mutation.notice} />
        </form>
      </section>
    </>
  );
}
export function CommunicationDetail({ reference }: { reference: string }) {
  const [page, setPage] = useState(1),
    data = useAdminData<Message>(
      `operations/communications/${reference}?page=${page}`,
    ),
    m = data.data;
  return (
    <OperationalFrame
      area="communications"
      title={m?.subject || 'Communication plan'}
      data={data}
    >
      {m && (
        <>
          <section className="admin-card ops-detail">
            <h2>{m.batch}</h2>
            <p>
              {m.channel} · {m.purpose} · Planned by {m.initiator} ·{' '}
              {new Date(m.at).toLocaleString('en-GB')}
            </p>
            <p className="ops-plain-text">{m.body}</p>
            <div className="academic-actions">
              {m.counts.map((c) => (
                <Pill key={c.status}>
                  {c.count} {c.status}
                </Pill>
              ))}
            </div>
            <p className="admin-muted">
              Provider unavailable. These are delivery plans; no message has
              been sent.
            </p>
          </section>
          <section className="admin-card academic-table">
            <Table
              caption="Resolved delivery plans"
              headers={['Student', 'Status', 'Reason']}
            >
              {m.rows.map((r, n) => (
                <tr key={n}>
                  <td>{r.student}</td>
                  <td>
                    <Pill>{r.status}</Pill>
                  </td>
                  <td>{r.reason}</td>
                </tr>
              ))}
            </Table>
            <Pager page={page} total={m.total} onPage={setPage} />
          </section>
        </>
      )}
    </OperationalFrame>
  );
}
