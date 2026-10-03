'use client';
import { useState } from 'react';
import { useAdminData, useAdminMutation } from '../client';
import { Field, FormActions } from '../academic/forms';
import { Pager, Pill, AdminDialog } from '../Primitives';
import { OperationalFrame } from './Frame';
import type { Discussion, Ticket, Referral } from './types';
export function DiscussionModeration({ reference }: { reference: string }) {
  const [page, setPage] = useState(1),
    [edit, setEdit] = useState(false),
    path = `operations/discussions/${reference}`,
    data = useAdminData<Discussion>(`${path}?page=${page}`),
    d = data.data,
    mutation = useAdminMutation(() => {
      data.reload();
      setEdit(false);
    });
  return (
    <OperationalFrame
      area="discussions"
      title={d?.title || 'Discussion thread'}
      data={data}
    >
      {d && (
        <>
          <section className="admin-card">
            <p>
              {d.course} · {d.batch} · Started by {d.author} ·{' '}
              <Pill>{d.locked ? 'LOCKED' : 'OPEN'}</Pill>
            </p>
            <p className="admin-muted">
              Moderation controls replies through locking. Original content and
              author attribution are preserved; hiding/editing/removal states
              are not supported.
            </p>
            <button className="admin-button" onClick={() => setEdit(true)}>
              {d.locked ? 'Unlock thread' : 'Lock thread'}
            </button>
          </section>
          <section className="admin-card ops-detail">
            {d.posts.map((p, n) => (
              <article className="ops-message" key={n}>
                <strong>{p.author}</strong>
                <small> · {new Date(p.at).toLocaleString('en-GB')}</small>
                <p className="ops-plain-text">{p.body}</p>
              </article>
            ))}
            <Pager page={page} total={d.total} onPage={setPage} />
          </section>
          {edit && (
            <AdminDialog
              title={d.locked ? 'Unlock discussion' : 'Lock discussion'}
              onClose={() => setEdit(false)}
            >
              <form
                className="admin-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await mutation.save(`${path}/lock`, {
                    locked: !d.locked,
                    reason: new FormData(e.currentTarget).get('reason'),
                  });
                }}
              >
                <Field label="Moderation reason">
                  <textarea name="reason" required maxLength={500} />
                </Field>
                <FormActions busy={mutation.busy} notice={mutation.notice} />
              </form>
            </AdminDialog>
          )}
        </>
      )}
    </OperationalFrame>
  );
}
export function SupportTicket({ reference }: { reference: string }) {
  const [page, setPage] = useState(1),
    path = `operations/support/${reference}`,
    data = useAdminData<Ticket>(`${path}?page=${page}`),
    t = data.data,
    mutation = useAdminMutation(data.reload);
  return (
    <OperationalFrame
      area="support"
      title={t?.title || 'Support ticket'}
      data={data}
    >
      {t && (
        <>
          <section className="admin-card">
            <h2>{t.reference}</h2>
            <p>
              {t.student.name} · {t.category} · <Pill>{t.status}</Pill>
            </p>
            <p>
              Created {new Date(t.createdAt).toLocaleString('en-GB')} · Updated{' '}
              {new Date(t.updatedAt).toLocaleString('en-GB')}
            </p>
          </section>
          <section
            className="admin-card ops-detail"
            aria-label="Support conversation"
          >
            {t.messages.map((m, n) => (
              <article className="ops-message" key={n}>
                <strong>
                  {m.author} ·{' '}
                  {m.actor === 'STAFF' ? 'Admin / Staff' : 'Student'}
                </strong>
                <small> · {new Date(m.at).toLocaleString('en-GB')}</small>
                <p className="ops-plain-text">{m.body}</p>
              </article>
            ))}
            <Pager page={page} total={t.total} onPage={setPage} />
          </section>
          <section className="admin-card ops-detail">
            <h2>Admin reply / status</h2>
            <form
              className="admin-form"
              key={`${t.status}:${t.updatedAt}`}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await mutation.save(`${path}/reply`, {
                  status: f.get('status'),
                  body: f.get('body') || null,
                });
              }}
            >
              <Field label="Ticket status">
                <select name="status" defaultValue={t.status}>
                  {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Admin reply (optional)">
                <textarea
                  name="body"
                  maxLength={4000}
                  disabled={!['OPEN', 'IN_PROGRESS'].includes(t.status)}
                />
              </Field>
              {!['OPEN', 'IN_PROGRESS'].includes(t.status) && (
                <p>Reopen the ticket before adding a reply.</p>
              )}
              <p className="admin-muted">
                Author is derived from your authenticated Admin account. No
                agent-presence or response-time claim.
              </p>
              <FormActions busy={mutation.busy} notice={mutation.notice} />
            </form>
          </section>
        </>
      )}
    </OperationalFrame>
  );
}
export function ReferralDetail({ reference }: { reference: string }) {
  const [page, setPage] = useState(1),
    data = useAdminData<Referral>(
      `operations/referrals/${reference}?page=${page}`,
    ),
    r = data.data;
  return (
    <OperationalFrame
      area="referrals"
      title={r?.code || 'Referral identity'}
      data={data}
    >
      {r && (
        <section className="admin-card ops-detail">
          <h2>{r.student.name}</h2>
          <p>
            Created {new Date(r.createdAt).toLocaleString('en-GB')} · {r.total}{' '}
            attributions
          </p>
          <p className="admin-muted">
            Read-only attribution history. Source metadata and correction
            workflows do not exist in the current model.
          </p>
          {r.rows.map((a) => (
            <article className="ops-message" key={a.student.ref}>
              <strong>{a.student.name}</strong>
              <p>Joined {new Date(a.joinedAt).toLocaleString('en-GB')}</p>
            </article>
          ))}
          {!r.rows.length && <p>No referred users recorded.</p>}
          <Pager page={page} total={r.total} onPage={setPage} />
        </section>
      )}
    </OperationalFrame>
  );
}
