'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LmsStatusBadge } from './LmsPrimitives';
import type { Assignments } from '@/lib/lms/assignments';
type Assignment = Awaited<ReturnType<Assignments['view']>>;
export function AssignmentDetail({
  assignment: a,
  courseId,
}: {
  assignment: Assignment;
  courseId: string;
}) {
  const [kind, setKind] = useState(a.allowedKinds[0]),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const files = useRef<HTMLInputElement>(null),
    key = useRef<string | null>(null),
    status = useRef<HTMLParagraphElement>(null),
    router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    key.current ||= crypto.randomUUID();
    try {
      const payload = {
          requestKey: key.current,
          kind,
          ...(kind !== 'FILE' ? { text } : {}),
        },
        form = new FormData();
      form.append('payload', JSON.stringify(payload));
      if (kind !== 'TEXT')
        for (const file of files.current?.files || [])
          form.append('files', file);
      const r = await fetch(
        `/api/lms/academic/courses/${courseId}/assignments/${a.id}/submit`,
        { method: 'POST', body: form },
      );
      if (!r.ok) throw Error();
      key.current = null;
      setText('');
      if (files.current) files.current.value = '';
      setMessage('Submission saved. Previous versions are preserved.');
      router.refresh();
    } catch {
      setMessage(
        'Submission could not be saved. Check the submission type, file limits and your access.',
      );
    } finally {
      setBusy(false);
      status.current?.focus();
    }
  }
  return (
    <div className="lms-assignment-layout">
      <div className="l3-assignment">
        <p className="lms-eyebrow">
          Assignment ·{' '}
          {a.versions[0]?.status.replaceAll('_', ' ').toLowerCase() ||
            'Not submitted'}
        </p>
        <p className="l3-text">{a.instructions}</p>
        {a.dueAt && (
          <p>
            Due:{' '}
            <time dateTime={a.dueAt}>
              {new Date(a.dueAt).toLocaleString('en-US', { timeZone: 'UTC' })}{' '}
              UTC
            </time>
          </p>
        )}
        <p>
          {a.requiresAcceptance
            ? 'Completion requires acceptance by a reviewer.'
            : 'A valid submission satisfies this assignment requirement.'}
        </p>
        {a.canSubmit ? (
          <form onSubmit={submit} className="l3-form">
            <label htmlFor="submission-kind">Submission type</label>
            <select
              disabled={busy}
              id="submission-kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                key.current = null;
              }}
            >
              {a.allowedKinds.map((k) => (
                <option key={k} value={k}>
                  {
                    {
                      TEXT: 'Text',
                      FILE: 'Files',
                      TEXT_AND_FILE: 'Text and files',
                    }[k]
                  }
                </option>
              ))}
            </select>
            {kind !== 'FILE' && (
              <>
                <label htmlFor="submission-text">Your response</label>
                <textarea
                  disabled={busy}
                  id="submission-text"
                  maxLength={12000}
                  rows={7}
                  required
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    key.current = null;
                  }}
                />
              </>
            )}
            {kind !== 'TEXT' && (
              <>
                <label htmlFor="submission-files">Files</label>
                <input
                  disabled={busy}
                  id="submission-files"
                  type="file"
                  multiple
                  ref={files}
                  required
                  accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,text/plain"
                  onChange={() => {
                    key.current = null;
                  }}
                />
                <p className="lms-muted">
                  PDF, images or plain text. Maximum {a.maxFiles} files,{' '}
                  {Math.round(a.maxFileBytes / 1024 ** 2)} MB each.
                </p>
              </>
            )}
            <button type="submit" disabled={busy}>
              {busy
                ? 'Saving…'
                : a.versions.length
                  ? 'Submit new version'
                  : 'Submit assignment'}
            </button>
          </form>
        ) : (
          <p>Submission is locked while under review or accepted.</p>
        )}
        <p ref={status} tabIndex={-1} role="status">
          {message}
        </p>
        <section className="l3-history">
          <h3>Submission history</h3>
          {a.versions.length ? (
            a.versions.map((v) => (
              <article key={v.id}>
                <h4>
                  Version {v.number} ·{' '}
                  {v.status.replaceAll('_', ' ').toLowerCase()}
                </h4>
                <time dateTime={v.submittedAt}>
                  {new Date(v.submittedAt).toLocaleString('en-US', {
                    timeZone: 'UTC',
                  })}{' '}
                  UTC
                </time>
                {v.text && <p className="l3-text">{v.text}</p>}
                <ul>
                  {v.files.map((f) => (
                    <li key={f.id}>
                      <a
                        href={`/api/lms/academic/courses/${courseId}/assignments/${a.id}/files/${f.id}?download=1`}
                      >
                        Download {f.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
                {v.reviews.map((r, i) => (
                  <div key={i}>
                    <p>
                      Reviewer feedback ·{' '}
                      {r.status.replaceAll('_', ' ').toLowerCase()}
                    </p>
                    <p className="l3-text">{r.feedback}</p>
                    <time dateTime={r.reviewedAt}>
                      {new Date(r.reviewedAt).toLocaleDateString('en-US', {
                        timeZone: 'UTC',
                      })}
                    </time>
                  </div>
                ))}
              </article>
            ))
          ) : (
            <p>No submissions yet.</p>
          )}
        </section>
      </div>
      <aside className="lms-assignment-meta" aria-label="Assignment details">
        <h3>Submission details</h3>
        <LmsStatusBadge status={a.versions[0]?.status || 'NOT_SUBMITTED'} />
        <dl>
          <div>
            <dt>Accepted submission types</dt>
            <dd>
              {a.allowedKinds
                .map((k) => k.replaceAll('_', ' ').toLowerCase())
                .join(', ')}
            </dd>
          </div>
          <div>
            <dt>File limits</dt>
            <dd>
              {a.maxFiles} files · {Math.round(a.maxFileBytes / 1024 ** 2)} MB
              each
            </dd>
          </div>
          <div>
            <dt>Completion</dt>
            <dd>
              {a.requiresAcceptance
                ? 'Reviewer acceptance required'
                : 'Valid submission required'}
            </dd>
          </div>
          <div>
            <dt>History</dt>
            <dd>{a.versions.length} submitted versions</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
