'use client';
import { useState } from 'react';
import { useAdminData, useAdminMutation } from '../client';
import { Field, FormActions } from '../academic/forms';
import { Pill, Pager, AdminDialog } from '../Primitives';
import { OperationalFrame } from './Frame';
import type { Submission, Attempt } from './types';
export function AssignmentReview({ reference }: { reference: string }) {
  const [page, setPage] = useState(1),
    [version, setVersion] = useState<Submission['versions'][number] | null>(
      null,
    ),
    path = `operations/submissions/${reference}`,
    data = useAdminData<Submission>(`${path}?page=${page}`),
    s = data.data,
    mutation = useAdminMutation(() => {
      data.reload();
      setVersion(null);
    });
  return (
    <OperationalFrame
      area="submissions"
      title={s?.title || 'Assignment submission'}
      data={data}
    >
      {s && (
        <>
          <section className="admin-card">
            <p>
              {s.student.name} · {s.course}
            </p>
            <p className="admin-muted">
              Versions and file contents are immutable. Only the latest version
              accepts a review. Earlier feedback stays in history.
            </p>
          </section>
          {s.versions.map((v) => (
            <section key={v.ref} className="admin-card ops-detail">
              <div className="ops-record-heading">
                <h2>
                  Version {v.number} {v.latest ? '· Latest' : ''}
                </h2>
                <Pill>{v.status}</Pill>
              </div>
              <p>
                {v.kind} · {new Date(v.at).toLocaleString('en-GB')}
              </p>
              {v.text && <p className="ops-plain-text">{v.text}</p>}
              {v.files.length > 0 && (
                <ul>
                  {v.files.map((f) => (
                    <li key={f.ref}>
                      <a href={`/api/admin/${path}/files/${f.ref}?download=1`}>
                        {f.fileName}
                      </a>{' '}
                      · {f.mimeType} · {f.bytes.toLocaleString()} bytes
                    </li>
                  ))}
                </ul>
              )}
              <h3>Review history</h3>
              {v.reviews.map((r, n) => (
                <article key={n} className="ops-message">
                  <strong>
                    {r.reviewer} · {r.status}
                  </strong>
                  <p className="ops-plain-text">{r.feedback}</p>
                  <small>{new Date(r.at).toLocaleString('en-GB')}</small>
                </article>
              ))}
              {!v.reviews.length && <p>No reviews yet.</p>}
              {v.latest && (
                <button className="admin-button" onClick={() => setVersion(v)}>
                  Review latest version
                </button>
              )}
            </section>
          ))}
          <Pager page={page} total={s.total} onPage={setPage} />
          {version && (
            <AdminDialog
              title={`Review Version ${version.number}`}
              onClose={() => setVersion(null)}
            >
              <form
                className="admin-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await mutation.save(`${path}/review`, {
                    versionId: version.ref,
                    userId: s.student.ref,
                    courseId: s.courseRef,
                    itemId: s.itemRef,
                    status: f.get('status'),
                    feedback: f.get('feedback'),
                  });
                }}
              >
                <Field label="Review outcome">
                  <select name="status" defaultValue="UNDER_REVIEW">
                    {['UNDER_REVIEW', 'CHANGES_REQUESTED', 'ACCEPTED'].map(
                      (x) => (
                        <option key={x}>{x}</option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Assignment feedback">
                  <textarea name="feedback" required maxLength={4000} />
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
export function AttemptReview({ reference }: { reference: string }) {
  const [response, setResponse] = useState<Attempt['responses'][number] | null>(
      null,
    ),
    path = `operations/attempts/${reference}`,
    data = useAdminData<Attempt>(path),
    a = data.data,
    mutation = useAdminMutation(() => {
      data.reload();
      setResponse(null);
    });
  return (
    <OperationalFrame
      area="attempts"
      title={a?.title || 'Attempt review'}
      data={data}
    >
      {a && (
        <>
          <section className="admin-card">
            <h2>
              {a.kind} · Attempt {a.number}
            </h2>
            <p>
              {a.student.name} · {a.course} · <Pill>{a.status}</Pill>
            </p>
            <p>
              Current result: {a.score}/{a.maxScore} ·{' '}
              {a.percentage?.toFixed(1)}%{' '}
              {a.status === 'PENDING'
                ? '· Human review remains incomplete.'
                : a.passed === null
                  ? '· No passing threshold.'
                  : a.passed
                    ? '· Passed'
                    : '· Not passed'}
            </p>
            <p className="admin-muted">
              Point ceilings, submitted answers and objective scoring come from
              immutable snapshots. Corrections replace one effective human
              outcome and are audited.
            </p>
          </section>
          {a.responses.map((r, n) => (
            <section key={r.ref} className="admin-card ops-detail">
              <h2>
                Response {n + 1} · {r.type}
              </h2>
              <p className="ops-plain-text">{r.prompt}</p>
              {r.text && (
                <blockquote className="ops-plain-text">{r.text}</blockquote>
              )}
              {r.options.map((o, n) => (
                <p key={n}>
                  {o.selected ? 'Selected' : 'Not selected'}: {o.label} ·{' '}
                  {o.correct ? 'Correct option' : 'Other option'}
                </p>
              ))}
              <p>
                {r.awardedPoints === null
                  ? 'Pending review'
                  : `${r.awardedPoints} awarded`}{' '}
                / {r.points} snapshot points
              </p>
              {r.review && (
                <article className="ops-message">
                  <strong>
                    {r.review.reviewer} ·{' '}
                    {new Date(r.review.at).toLocaleString('en-GB')}
                  </strong>
                  <p className="ops-plain-text">
                    {r.review.feedback || 'No feedback provided.'}
                  </p>
                </article>
              )}
              {r.manual ? (
                <button className="admin-button" onClick={() => setResponse(r)}>
                  {r.review ? 'Correct review' : 'Review text response'}
                </button>
              ) : (
                <p className="admin-muted">
                  Objective score is server-authoritative; manual override is
                  unavailable.
                </p>
              )}
            </section>
          ))}
          {response && (
            <AdminDialog
              title={
                response.review ? 'Correct text review' : 'Review text response'
              }
              onClose={() => setResponse(null)}
            >
              <form
                className="admin-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await mutation.save(`${path}/review`, {
                    courseId: a.courseRef,
                    itemId: a.itemRef,
                    userId: a.student.ref,
                    responseId: response.ref,
                    awardedPoints: Number(f.get('points')),
                    feedback: f.get('feedback') || null,
                  });
                }}
              >
                <p className="ops-plain-text">{response.text}</p>
                <Field label="Awarded points">
                  <input
                    name="points"
                    type="number"
                    min={0}
                    max={response.points}
                    step={1}
                    required
                    defaultValue={response.awardedPoints ?? 0}
                  />
                </Field>
                <Field label="Review feedback (optional)">
                  <textarea
                    name="feedback"
                    maxLength={2000}
                    defaultValue={response.review?.feedback || ''}
                  />
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
