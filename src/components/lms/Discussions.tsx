'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Discussions } from '@/lib/lms/discussions';
import { lmsHref } from '@/lib/platform/domains';
type Workspace = Awaited<ReturnType<Discussions['workspace']>>;
type Thread = Awaited<ReturnType<Discussions['thread']>>;
async function send(path: string, body: unknown) {
  const response = await fetch(`/api/lms/discussions${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || 'Unable to save. Please try again.');
  return data as { id: string };
}
export function DiscussionWorkspace({ workspace }: { workspace: Workspace }) {
  const router = useRouter(),
    feedback = useRef<HTMLParagraphElement>(null);
  const [courseId, setCourse] = useState(workspace.courses[0]?.id || ''),
    [batchId, setBatch] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const course = workspace.courses.find((c) => c.id === courseId);
  const batches = workspace.batches.filter(
    (b) =>
      (!b.courseId && !b.programId) ||
      b.courseId === courseId ||
      (!!course?.programId && b.programId === course.programId),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setMessage('');
    try {
      const thread = await send('', {
        courseId,
        ...(batchId ? { batchId } : {}),
        title: data.get('title'),
        body: data.get('body'),
      });
      router.push(lmsHref(`/learn/discussions/${thread.id}`));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to connect. Please try again.',
      );
      requestAnimationFrame(() => feedback.current?.focus());
      setBusy(false);
    }
  }
  return (
    <>
      <div className="lms-heading">
        <div>
          <p className="lms-eyebrow">Learn together</p>
          <h1>Discussions</h1>
          <p>
            Ask questions and share learning within your courses and batches.
          </p>
        </div>
      </div>
      <div className="l4-discussion-grid">
        <section className="lms-panel">
          <h2>Recent threads</h2>
          {workspace.threads.length ? (
            <ul className="l4-thread-list">
              {workspace.threads.map((t) => (
                <li key={t.id}>
                  <Link href={lmsHref(`/learn/discussions/${t.id}`)}>
                    {t.title}
                  </Link>
                  <p>
                    {t.course.title}
                    {t.batch ? ` · ${t.batch.name}` : ' · Course discussion'}
                  </p>
                  <small>
                    {t._count.posts} posts{t.locked ? ' · Locked' : ''}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No discussions yet. Start a learning conversation in an enrolled
              course.
            </p>
          )}
        </section>
        <section className="lms-panel">
          <h2>Start a discussion</h2>
          {workspace.courses.length ? (
            <form className="l4-discussion-form" onSubmit={submit}>
              <label htmlFor="discussion-course">Course</label>
              <select
                id="discussion-course"
                value={courseId}
                disabled={busy}
                onChange={(e) => {
                  setCourse(e.target.value);
                  setBatch('');
                }}
              >
                {workspace.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <label htmlFor="discussion-batch">Audience</label>
              <select
                id="discussion-batch"
                value={batchId}
                disabled={busy}
                onChange={(e) => setBatch(e.target.value)}
              >
                <option value="">Enrolled course members</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <label htmlFor="discussion-title">Title</label>
              <input
                id="discussion-title"
                name="title"
                minLength={3}
                maxLength={160}
                required
                disabled={busy}
              />
              <label htmlFor="discussion-body">Your question or message</label>
              <textarea
                id="discussion-body"
                name="body"
                maxLength={6000}
                rows={5}
                required
                disabled={busy}
              />
              <p className="l4-form-hint">
                Plain text only. Avoid sharing personal or sensitive
                information.
              </p>
              <button className="lms-action" disabled={busy} type="submit">
                {busy ? 'Creating…' : 'Create thread'}
              </button>
              <p role="alert" tabIndex={-1} ref={feedback}>
                {message}
              </p>
            </form>
          ) : (
            <p>
              Enrollments are required to start discussions. Contact Support for
              access.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
export function DiscussionConversation({ thread }: { thread: Thread }) {
  const router = useRouter(),
    feedback = useRef<HTMLParagraphElement>(null),
    field = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      body = new FormData(form).get('body');
    setBusy(true);
    setMessage('');
    try {
      await send(`/${thread.id}/reply`, { body });
      form.reset();
      setMessage('Reply posted.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to connect. Please try again.',
      );
    } finally {
      setBusy(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  return (
    <>
      <Link className="l4-back" href={lmsHref('/learn/discussions')}>
        ← All discussions
      </Link>
      <div className="lms-heading">
        <div>
          <p className="lms-eyebrow">
            {thread.course.title}
            {thread.batch ? ` · ${thread.batch.name}` : ''}
          </p>
          <h1>{thread.title}</h1>
          <p>
            {thread.locked
              ? 'This discussion is locked.'
              : 'A conversation with your course members.'}
          </p>
        </div>
      </div>
      <section
        className="lms-panel l4-conversation"
        aria-label="Discussion posts"
      >
        <ol>
          {thread.posts.map((p) => (
            <li key={p.id}>
              <article>
                <header>
                  <strong>{p.author}</strong>
                  <time dateTime={p.createdAt}>
                    {new Date(p.createdAt)
                      .toISOString()
                      .slice(0, 16)
                      .replace('T', ' ')}{' '}
                    UTC
                  </time>
                </header>
                <p>{p.body}</p>
              </article>
            </li>
          ))}
        </ol>
        {thread.older && (
          <Link
            href={`${lmsHref(`/learn/discussions/${thread.id}`)}?before=${thread.older}`}
          >
            Older posts →
          </Link>
        )}
        {thread.older && <p>Showing 50 posts on this page.</p>}
      </section>
      {!thread.locked && (
        <section className="lms-panel">
          <h2>Reply</h2>
          <form onSubmit={submit} className="l4-discussion-form">
            <label htmlFor="discussion-reply">Your message</label>
            <textarea
              ref={field}
              id="discussion-reply"
              name="body"
              maxLength={6000}
              rows={4}
              required
              disabled={busy}
            />
            <button type="submit" className="lms-action" disabled={busy}>
              {busy ? 'Posting…' : 'Post reply'}
            </button>
            <p role="status" tabIndex={-1} ref={feedback}>
              {message}
            </p>
          </form>
        </section>
      )}
    </>
  );
}
