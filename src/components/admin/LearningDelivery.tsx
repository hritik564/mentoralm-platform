'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { adminHref } from '@/lib/platform/domains';
import {
  learningRecordingGroup,
  learningSessionGroup,
} from '@/lib/admin/learning';
import { useAdminAccess } from './AdminShell';
import { useAdminData } from './client';
import { Pager, Pill, State, Table } from './Primitives';
import type { BatchDetail, BatchList } from './types';

export function LearningSessions({
  recordings = false,
}: {
  recordings?: boolean;
}) {
  const search = useSearchParams();
  const batchRef = search.get('batch');
  const base = recordings
    ? '/admin/learning/recordings'
    : '/admin/learning/classes';
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Learning workspace</p>
          <h1>{recordings ? 'Recordings' : 'Live Classes'}</h1>
          <p>
            {recordings
              ? 'Review recording readiness and manage published sessions.'
              : 'Today, upcoming and past classes for your selected Batch.'}
          </p>
        </div>
      </div>
      {recordings && (
        <section className="admin-card learning-provider-note">
          <h2>Recording publishing is not configured</h2>
          <p className="admin-muted">
            Private upload, processing and new publication require a configured
            storage provider. Existing metadata and unpublish controls remain
            available. Watching recordings never changes attendance.
          </p>
        </section>
      )}
      {batchRef ? (
        <SelectedBatch
          key={batchRef}
          batchRef={batchRef}
          recordings={recordings}
          base={base}
        />
      ) : (
        <BatchPicker recordings={recordings} base={base} />
      )}
    </>
  );
}
function BatchPicker({
  recordings,
  base,
}: {
  recordings: boolean;
  base: string;
}) {
  const [page, setPage] = useState(1),
    [q, setQ] = useState('');
  const request = useAdminData<BatchList>(
    `batches?${new URLSearchParams({ page: String(page), q })}`,
  );
  return (
    <section className="admin-card admin-list-card">
      <header className="learning-picker-heading">
        <h2>Choose a Batch</h2>
        <p className="admin-muted">
          View {recordings ? 'recordings' : 'classes'} within one Batch.
          Scheduling continues in its existing Live Sessions workspace.
        </p>
      </header>
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(String(new FormData(e.currentTarget).get('q') || ''));
          setPage(1);
        }}
      >
        <label className="admin-search-field">
          <span className="sr-only">Search Batches</span>
          <input
            name="q"
            maxLength={100}
            placeholder="Find a Batch by name or code…"
          />
        </label>
        <button className="admin-button secondary" type="submit">
          Search Batches
        </button>
      </form>
      <State {...request} />
      {request.data && (
        <>
          <Table
            caption={
              recordings ? 'Batch recording management' : 'Batch live classes'
            }
            headers={['Batch', 'Learning scope', 'Status', 'Action']}
          >
            {request.data.rows.map((batch) => (
              <tr key={batch.ref}>
                <td>
                  <strong>{batch.name}</strong>
                  <small>{batch.code}</small>
                </td>
                <td>{batch.scope}</td>
                <td>
                  <Pill>{batch.status}</Pill>
                </td>
                <td>
                  <Link
                    className="admin-text-link"
                    href={`${adminHref(base)}?${new URLSearchParams({ batch: batch.ref })}`}
                  >
                    {recordings ? 'View recordings' : 'View classes'} →
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
          {!request.data.rows.length && (
            <div className="admin-empty">
              <h2>No matching Batches</h2>
              <p>Create a Batch before scheduling its first class.</p>
              <Link
                className="admin-button secondary"
                href={`${adminHref('/admin/batches')}?create=batch`}
              >
                Create Batch
              </Link>
            </div>
          )}
          <Pager page={page} total={request.data.total} onPage={setPage} />
        </>
      )}
    </section>
  );
}
function SelectedBatch({
  batchRef,
  recordings,
  base,
}: {
  batchRef: string;
  recordings: boolean;
  base: string;
}) {
  const request = useAdminData<BatchDetail>(
    `batches/${encodeURIComponent(batchRef)}?page=1`,
  );
  const { permissions } = useAdminAccess();
  const [now] = useState(() => new Date());
  const batch = request.data;
  const groups = recordings
    ? (['Needs Publishing', 'Published', 'Processing / Unavailable'] as const)
    : (['Today', 'Upcoming', 'Past'] as const);
  return (
    <>
      <Link className="admin-back" href={adminHref(base)}>
        ← Choose another Batch
      </Link>
      <State {...request} />
      {batch && (
        <>
          <section className="admin-card learning-selected-batch">
            <div>
              <h2>{batch.name}</h2>
              <p className="admin-muted">
                {batch.scope} · {batch.code}
              </p>
              <p className="admin-muted learning-context-note">
                Most recent 50 Batch sessions · times in UTC. Sessions beyond
                this existing view are not included.
              </p>
            </div>
            <div className="learning-context-actions">
              <Link
                className="admin-button secondary"
                href={`${adminHref(`/admin/batches/${batch.ref}`)}?tab=${recordings ? 'recordings' : 'sessions'}`}
              >
                Open Batch {recordings ? 'Recordings' : 'Live Sessions'}
              </Link>
              {!recordings && (
                <Link
                  className="admin-button"
                  href={`${adminHref(`/admin/batches/${batch.ref}`)}?tab=sessions&create=session`}
                >
                  Schedule Class
                </Link>
              )}
            </div>
          </section>
          {groups.map((group) => {
            const rows = batch.sessions
              .filter(
                (session) =>
                  (recordings
                    ? learningRecordingGroup(session.recording)
                    : learningSessionGroup(session, now)) === group,
              )
              .sort((a, b) =>
                group === 'Past'
                  ? b.starts.localeCompare(a.starts)
                  : a.starts.localeCompare(b.starts),
              );
            return (
              <section
                className="admin-card learning-session-group"
                key={group}
                aria-label={group}
              >
                <header className="admin-card-heading">
                  <h2>{group}</h2>
                  <span className="admin-muted">
                    {rows.length} {recordings ? 'sessions' : 'classes'}
                  </span>
                </header>
                {rows.length ? (
                  <ul className="learning-context-list">
                    {rows.map((session) => (
                      <li key={session.ref} className="learning-context-row">
                        <div>
                          <strong>
                            {recordings
                              ? session.recording?.title || session.title
                              : session.title}
                          </strong>
                          <p className="learning-session-meta">
                            {session.itemTitle || 'No linked learning item'} ·{' '}
                            {session.instructorName ||
                              'Instructor not assigned'}
                          </p>
                          <time
                            className="learning-session-meta"
                            dateTime={session.starts}
                          >
                            {new Date(session.starts).toLocaleString('en-GB', {
                              timeZone: 'UTC',
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            UTC
                          </time>
                          <div className="learning-context-meta">
                            <Pill>
                              {recordings
                                ? session.recording?.cleanupPending
                                  ? 'Cleanup pending'
                                  : session.recording?.status || 'No recording'
                                : session.status}
                            </Pill>
                            {session.courseRef &&
                              permissions.includes('ACADEMICS_MANAGE') && (
                                <Link
                                  className="admin-text-link"
                                  href={`${adminHref(`/admin/courses/${session.courseRef}`)}?tab=classes`}
                                >
                                  Open Course
                                </Link>
                              )}
                          </div>
                        </div>
                        <Link
                          className="admin-button secondary"
                          href={`${adminHref(`/admin/batches/${batch.ref}`)}?${new URLSearchParams({ tab: recordings ? 'recordings' : 'sessions', session: session.ref })}`}
                        >
                          {recordings ? 'Manage recording' : 'Open Class'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-muted">
                    {recordings
                      ? 'No sessions in this recording group.'
                      : `No ${group.toLowerCase()} classes in this Batch view.`}
                  </p>
                )}
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
