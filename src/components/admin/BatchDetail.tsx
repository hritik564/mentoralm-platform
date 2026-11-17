'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { adminHref } from '@/lib/platform/domains';
import { useAdminData, useAdminMutation } from './client';
import { useAdminAccess } from './AdminShell';
import {
  State,
  Tabs,
  Table,
  Pill,
  AccessPill,
  DateText,
  Pager,
  AdminDialog,
} from './Primitives';
import { BatchEditor, SessionEditor } from './editors';
import type { BatchDetail as Detail, Choice, StudentList } from './types';
export function AdminBatchDetail({ refId }: { refId: string }) {
  const search = useSearchParams(),
    router = useRouter(),
    { permissions } = useAdminAccess(),
    { data, error, loading, reload } = useAdminData<Detail>(
      `batches/${refId}?page=${search.get('page') || '1'}`,
    ),
    mutation = useAdminMutation(reload),
    [editing, setEditing] = useState(false),
    [adding, setAdding] = useState<'student' | 'instructor' | null>(null);
  const sections = [
    { key: 'overview', label: 'Overview' },
    { key: 'students', label: 'Students' },
    { key: 'instructors', label: 'Instructors' },
    { key: 'courses', label: 'Courses' },
    { key: 'sessions', label: 'Live Sessions' },
    ...(permissions.includes('ATTENDANCE_MANAGE')
      ? [{ key: 'attendance', label: 'Attendance' }]
      : []),
    ...(permissions.includes('ACADEMICS_MANAGE')
      ? [{ key: 'assignments', label: 'Assignments' }]
      : []),
    { key: 'recordings', label: 'Recordings' },
  ];
  return (
    <>
      <Link className="admin-back" href={adminHref('/admin/batches')}>
        ← Back to Batches
      </Link>
      <State {...{ loading, error, reload }} />
      {data && (
        <>
          <div className="admin-detail-heading">
            <span className="admin-avatar violet" aria-hidden="true">
              ▦
            </span>
            <div>
              <h1>{data.name}</h1>
              <p>
                {data.code} · {data.scope}
              </p>
              <p>
                <DateText value={data.starts} /> –{' '}
                <DateText value={data.ends} /> · {data.counts.students}{' '}
                memberships · {data.counts.instructors} instructors
              </p>
            </div>
            <Pill>{data.status}</Pill>
            <button
              className="admin-button secondary"
              onClick={() => setEditing(true)}
            >
              Edit Batch
            </button>
          </div>
          <p role="status" className="admin-save-notice">
            {mutation.notice}
          </p>
          <div className="learning-batch-context">
            <Tabs
              active={
                sections.find((section) => section.key === search.get('tab'))
                  ?.label || 'Overview'
              }
              onChange={(tab) => {
                const section = sections.find(
                  (section) => section.label === tab,
                );
                if (!section) return;
                const next = new URLSearchParams(search.toString());
                next.set('tab', section.key);
                next.delete('create');
                router.push(`${adminHref(`/admin/batches/${refId}`)}?${next}`, {
                  scroll: false,
                });
              }}
              labels={sections.map((section) => section.label)}
            >
              {(tab) =>
                tab === 'Overview' ? (
                  <div className="admin-grid">
                    <section className="admin-card">
                      <h2>Batch overview</h2>
                      <dl className="admin-key-values">
                        {[
                          ['Code', data.code],
                          ['Status', data.status],
                          ['Scope', data.scope],
                          ['Student memberships', data.counts.students],
                          ['Assigned instructors', data.counts.instructors],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                    <section className="admin-card">
                      <h2>Batch LMS access</h2>
                      <p>
                        <AccessPill enabled={data.access} />
                      </p>
                      <p className="admin-muted">
                        Students inherit this state only when their individual
                        override is INHERIT and the Batch/membership meets
                        eligibility rules.
                      </p>
                      <button
                        className="admin-button"
                        disabled={mutation.busy}
                        onClick={() => {
                          if (
                            data.access &&
                            !confirm(
                              'Disable inherited LMS access for this Batch? Individual overrides remain unchanged.',
                            )
                          )
                            return;
                          void mutation.save(`batches/${data.ref}/access`, {
                            value: !data.access,
                          });
                        }}
                      >
                        {data.access
                          ? 'Disable Batch access'
                          : 'Enable Batch access'}
                      </button>
                    </section>
                  </div>
                ) : tab === 'Students' ? (
                  <section className="admin-card">
                    <header className="admin-card-heading">
                      <h2>Batch students</h2>
                      <button
                        className="admin-button"
                        onClick={() => setAdding('student')}
                      >
                        ＋ Add student
                      </button>
                    </header>
                    <Table
                      caption="Batch student membership"
                      headers={[
                        'Student',
                        'Student ID',
                        'Status',
                        'Joined',
                        'Left',
                        'Effective LMS',
                        'Action',
                      ]}
                    >
                      {data.members.map((m) => (
                        <tr key={m.ref}>
                          <td>
                            <Link
                              className="admin-row-link"
                              href={adminHref(`/admin/students/${m.ref}`)}
                            >
                              {m.name}
                            </Link>
                          </td>
                          <td>{m.studentId || 'Not assigned'}</td>
                          <td>
                            <Pill>{m.status}</Pill>
                          </td>
                          <td>
                            <DateText value={m.joined} />
                          </td>
                          <td>
                            <DateText value={m.left} />
                          </td>
                          <td>
                            <AccessPill enabled={m.effective.enabled} />
                          </td>
                          <td>
                            <button
                              className="admin-button secondary"
                              disabled={mutation.busy}
                              onClick={() => {
                                if (
                                  m.status === 'ACTIVE' &&
                                  !confirm(
                                    'Deactivate membership? Course Enrollment is unchanged.',
                                  )
                                )
                                  return;
                                void mutation.save(
                                  `batches/${data.ref}/memberships`,
                                  {
                                    userId: m.ref,
                                    status:
                                      m.status === 'ACTIVE'
                                        ? 'INACTIVE'
                                        : 'ACTIVE',
                                  },
                                );
                              }}
                            >
                              {m.status === 'ACTIVE'
                                ? 'Deactivate'
                                : 'Reactivate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Table>
                    <Pager
                      page={data.page}
                      total={data.total}
                      onPage={(n) => {
                        const next = new URLSearchParams(search.toString());
                        next.set('page', String(n));
                        next.set('tab', 'students');
                        router.push(
                          `${adminHref(`/admin/batches/${data.ref}`)}?${next}`,
                          { scroll: false },
                        );
                      }}
                    />
                  </section>
                ) : tab === 'Instructors' ? (
                  <section className="admin-card">
                    <header className="admin-card-heading">
                      <h2>Assigned instructors</h2>
                      <button
                        className="admin-button"
                        onClick={() => setAdding('instructor')}
                      >
                        ＋ Assign instructor
                      </button>
                    </header>
                    <Table
                      caption="Batch instructors"
                      headers={['Instructor', 'Assigned', 'Action']}
                    >
                      {data.instructors.map((i) => (
                        <tr key={i.ref}>
                          <td>{i.name}</td>
                          <td>
                            <DateText value={i.assigned} />
                          </td>
                          <td>
                            <button
                              className="admin-danger-button"
                              disabled={mutation.busy}
                              onClick={() => {
                                if (
                                  confirm(
                                    'Remove Batch assignment? Historical session instructor attribution is retained.',
                                  )
                                )
                                  void mutation.save(
                                    `batches/${data.ref}/instructors`,
                                    { instructorId: i.ref, assigned: false },
                                  );
                              }}
                            >
                              Remove assignment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Table>
                    {!data.instructors.length && (
                      <p className="admin-empty">No instructors assigned.</p>
                    )}
                  </section>
                ) : tab === 'Courses' ? (
                  <section className="admin-card">
                    <h2>Learning scope</h2>
                    <p>{data.scope}</p>
                    <p className="admin-callout">
                      Batch scope identifies delivery context. Each student
                      requires a separate Course Enrollment.
                    </p>
                    {data.courseRef ? (
                      permissions.includes('ACADEMICS_MANAGE') && (
                        <Link
                          className="admin-button secondary"
                          href={adminHref(`/admin/courses/${data.courseRef}`)}
                        >
                          Open Course
                        </Link>
                      )
                    ) : (
                      <p className="admin-muted">
                        This Batch has{' '}
                        {data.programRef
                          ? 'a Program scope'
                          : 'no Course scope'}
                        . No single Course is linked to this Batch.
                      </p>
                    )}
                  </section>
                ) : tab === 'Attendance' ? (
                  <section className="admin-card learning-context-panel">
                    <h2>Batch attendance</h2>
                    <p>Open a session to review its attendance roster.</p>
                    <Link
                      className="admin-button secondary"
                      href={`${adminHref('/admin/attendance')}?${new URLSearchParams({ batch: data.ref })}`}
                    >
                      Open Batch Attendance
                    </Link>
                    <ul className="learning-context-list">
                      {data.sessions.map((session) => (
                        <li className="learning-context-row" key={session.ref}>
                          <div>
                            <strong>{session.title}</strong>
                            <div className="learning-context-meta">
                              <span>
                                {new Date(session.starts).toLocaleString(
                                  'en-GB',
                                )}
                              </span>
                              <Pill>{session.status}</Pill>
                            </div>
                          </div>
                          <Link
                            className="admin-text-link"
                            href={adminHref(`/admin/attendance/${session.ref}`)}
                          >
                            Review attendance →
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <p className="admin-muted">
                      Most recent 50 sessions. Attendance can be edited for held
                      sessions.
                    </p>
                    {!data.sessions.length && (
                      <p className="admin-empty">
                        No Live Sessions in this Batch.
                      </p>
                    )}
                  </section>
                ) : tab === 'Assignments' ? (
                  <section className="admin-card learning-context-panel">
                    <h2>Batch assignments</h2>
                    {data.courseRef ? (
                      <>
                        <p>
                          Assignments belong to this Batch’s linked Course.
                          Reviews cover submitted work for the Course.
                        </p>
                        <div className="learning-context-actions">
                          <Link
                            className="admin-button secondary"
                            href={`${adminHref(`/admin/courses/${data.courseRef}`)}?tab=assignments`}
                          >
                            Open Course Assignments
                          </Link>
                          <Link
                            className="admin-text-link"
                            href={`${adminHref('/admin/submissions')}?${new URLSearchParams({ course: data.courseRef })}`}
                          >
                            Review Course submissions →
                          </Link>
                        </div>
                      </>
                    ) : (
                      <p className="admin-muted">
                        This Batch has{' '}
                        {data.programRef
                          ? 'a Program scope'
                          : 'no Course scope'}
                        . No single Course is linked, so Course assignments are
                        unavailable here.
                      </p>
                    )}
                  </section>
                ) : (
                  <LiveSessions
                    key={tab}
                    batch={data}
                    reload={reload}
                    recordsOnly={tab === 'Recordings'}
                  />
                )
              }
            </Tabs>
          </div>
          {editing && (
            <BatchEditor
              batch={data}
              onClose={() => setEditing(false)}
              onSaved={reload}
            />
          )}{' '}
          {adding && (
            <BatchAdder
              kind={adding}
              batch={data}
              onClose={() => setAdding(null)}
              onSaved={reload}
            />
          )}
        </>
      )}
    </>
  );
}
function BatchAdder({
  kind,
  batch,
  onClose,
  onSaved,
}: {
  kind: 'student' | 'instructor';
  batch: Detail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState(''),
    [selected, setSelected] = useState(''),
    students = useAdminData<StudentList>(
      kind === 'student' ? `students?q=${encodeURIComponent(q)}` : null,
    ),
    instructors = useAdminData<Choice[]>(
      kind === 'instructor'
        ? `choices/instructors?q=${encodeURIComponent(q)}`
        : null,
    ),
    mutation = useAdminMutation(onSaved);
  const choices =
    kind === 'student'
      ? students.data?.rows.map((s) => ({
          ref: s.ref,
          label: `${s.identity.name} · ${s.studentId || s.identity.email || 'Student'}`,
        })) || []
      : instructors.data || [];
  return (
    <AdminDialog
      title={
        kind === 'student' ? 'Add Batch student' : 'Assign Batch instructor'
      }
      onClose={onClose}
    >
      <div className="admin-form">
        {
          <label>
            {kind === 'student' ? 'Search students' : 'Search instructors'}
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSelected('');
              }}
              maxLength={100}
            />
          </label>
        }
        <label>
          {kind === 'student' ? 'Student' : 'Instructor'}
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a result</option>
            {choices.map((c) => (
              <option key={c.ref} value={c.ref}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <p className="admin-muted">
          {kind === 'student'
            ? 'Membership does not create Enrollment.'
            : 'Only existing users with persisted INSTRUCTOR authority can be assigned. Showing up to 50 instructors.'}
        </p>
        <p role="status">{mutation.notice}</p>
        <State
          loading={students.loading || instructors.loading}
          error={students.error || instructors.error}
          reload={() => {
            students.reload();
            instructors.reload();
          }}
        />
        <div className="admin-actions">
          <button
            className="admin-button"
            disabled={!selected || mutation.busy}
            onClick={async () => {
              const r = await mutation.save(
                `batches/${batch.ref}/${kind === 'student' ? 'memberships' : 'instructors'}`,
                kind === 'student'
                  ? { userId: selected, status: 'ACTIVE' }
                  : { instructorId: selected, assigned: true },
              );
              if (r) onClose();
            }}
          >
            Confirm assignment
          </button>
          <button className="admin-button secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}
function LiveSessions({
  batch,
  reload,
  recordsOnly = false,
}: {
  batch: Detail;
  reload: () => void;
  recordsOnly?: boolean;
}) {
  const search = useSearchParams(),
    router = useRouter(),
    [localEditor, setLocalEditor] = useState<'new' | 'edit' | null>(null),
    mutation = useAdminMutation(reload),
    requestedSession = search.get('session'),
    session = requestedSession
      ? batch.sessions.find((s) => s.ref === requestedSession)
      : batch.sessions[0],
    createIntent = !recordsOnly && search.get('create') === 'session',
    editor = recordsOnly ? null : createIntent ? 'new' : localEditor;
  function setChosen(reference: string) {
    setLocalEditor(null);
    const next = new URLSearchParams(search.toString());
    next.set('tab', recordsOnly ? 'recordings' : 'sessions');
    next.set('session', reference);
    next.delete('create');
    router.push(`${adminHref(`/admin/batches/${batch.ref}`)}?${next}`, {
      scroll: false,
    });
  }
  function setEditor(value: 'new' | 'edit' | null) {
    setLocalEditor(value);
    if (value === null && createIntent) {
      const next = new URLSearchParams(search.toString());
      next.delete('create');
      router.replace(`${adminHref(`/admin/batches/${batch.ref}`)}?${next}`, {
        scroll: false,
      });
    }
  }
  return (
    <div className="admin-session-layout">
      <section className="admin-card">
        <header className="admin-card-heading">
          <h2>{recordsOnly ? 'Recordings' : 'Live Sessions'}</h2>
          {!recordsOnly && (
            <button className="admin-button" onClick={() => setEditor('new')}>
              ＋ Add session
            </button>
          )}
        </header>
        <p className="admin-muted">Most recent 50 sessions.</p>
        <div className="admin-session-list">
          {batch.sessions.map((s) => (
            <button
              className={s.ref === session?.ref ? 'selected' : ''}
              key={s.ref}
              onClick={() => setChosen(s.ref)}
              aria-pressed={s.ref === session?.ref}
            >
              <strong>{s.title}</strong>
              <span>{new Date(s.starts).toLocaleString('en-GB')}</span>
              <Pill>
                {recordsOnly
                  ? s.recording?.cleanupPending
                    ? 'Cleanup pending'
                    : s.recording?.status || 'No recording'
                  : s.status}
              </Pill>
            </button>
          ))}
        </div>
        {!batch.sessions.length && (
          <p className="admin-empty">No Live Sessions in this Batch.</p>
        )}
      </section>
      <section className="admin-card">
        {session ? (
          <>
            <header className="admin-card-heading">
              <h2>{session.title}</h2>
              {!recordsOnly && (
                <button
                  className="admin-button secondary"
                  onClick={() => setEditor('edit')}
                >
                  Edit session
                </button>
              )}
            </header>
            <dl className="admin-key-values">
              <div>
                <dt>Instructor</dt>
                <dd>{session.instructorName || 'Not assigned'}</dd>
              </div>
              <div>
                <dt>Learning item</dt>
                <dd>{session.itemTitle || 'Not linked'}</dd>
              </div>
              <div>
                <dt>Starts</dt>
                <dd>{new Date(session.starts).toLocaleString('en-GB')}</dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>{new Date(session.ends).toLocaleString('en-GB')}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Pill>{session.status}</Pill>
                </dd>
              </div>
            </dl>
            <h3>Recording</h3>
            <div className="admin-recording-drop">
              <span aria-hidden="true">⇧</span>
              <strong>
                {session.recording
                  ? 'Recording metadata'
                  : 'No recording attached'}
              </strong>
              <p>
                Private video upload and processing require a configured storage
                adapter.
              </p>
              <button className="admin-button" disabled>
                Upload unavailable
              </button>
            </div>
            <p className="admin-callout">
              No permanent video URLs are accepted. Readiness must be confirmed
              before publication. Recording viewing never changes attendance.
            </p>
            {session.recording && (
              <>
                <p>
                  <Pill>{session.recording.status}</Pill>
                  {session.recording.cleanupPending && (
                    <Pill tone="bad">Cleanup pending</Pill>
                  )}
                </p>
                <dl className="admin-key-values">
                  <div>
                    <dt>Ready</dt>
                    <dd>
                      <DateText value={session.recording.readyAt} />
                    </dd>
                  </div>
                  <div>
                    <dt>Published</dt>
                    <dd>
                      <DateText value={session.recording.publishedAt} />
                    </dd>
                  </div>
                  <div>
                    <dt>File</dt>
                    <dd>{session.recording.fileName || 'Not supplied'}</dd>
                  </div>
                  <div>
                    <dt>Type / bytes</dt>
                    <dd>
                      {session.recording.mimeType || '—'} /{' '}
                      {session.recording.bytes || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>
                      {session.recording.durationSeconds == null
                        ? '—'
                        : `${session.recording.durationSeconds} seconds`}
                    </dd>
                  </div>
                </dl>
                <form
                  key={session.ref}
                  className="admin-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const f = new FormData(event.currentTarget);
                    void mutation.save(`sessions/${session.ref}/recording`, {
                      action: 'METADATA',
                      revision: session.recording!.revision,
                      title: f.get('title') || null,
                      description: f.get('description') || null,
                    });
                  }}
                >
                  <label>
                    Recording title
                    <input
                      name="title"
                      maxLength={160}
                      defaultValue={session.recording.title || ''}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      name="description"
                      maxLength={2000}
                      defaultValue={session.recording.description || ''}
                    />
                  </label>
                  <button
                    className="admin-button secondary"
                    disabled={mutation.busy || session.recording.cleanupPending}
                  >
                    Save recording metadata
                  </button>
                </form>
                <div className="admin-actions">
                  <button
                    className="admin-button"
                    disabled
                    title="Requires storage readiness verification"
                  >
                    Publish unavailable
                  </button>
                  {session.recording.status === 'PUBLISHED' && (
                    <button
                      className="admin-button secondary"
                      disabled={mutation.busy}
                      onClick={() => {
                        if (
                          confirm(
                            'Unpublish this recording? New playback access will stop.',
                          )
                        )
                          void mutation.save(
                            `sessions/${session.ref}/recording`,
                            {
                              action: 'UNPUBLISH',
                              revision: session.recording!.revision,
                            },
                          );
                      }}
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    className="admin-danger-button"
                    disabled
                    title="Storage cleanup must be available before deletion"
                  >
                    Delete unavailable
                  </button>
                  <button
                    className="admin-button secondary"
                    disabled
                    title="Requires confirmed private storage cleanup before a new upload"
                  >
                    Replace unavailable
                  </button>
                  {session.recording.cleanupPending && (
                    <button className="admin-button secondary" disabled>
                      Cleanup retry unavailable
                    </button>
                  )}
                </div>
              </>
            )}
            <p role="status">{mutation.notice}</p>
          </>
        ) : (
          <p className="admin-empty">
            {requestedSession
              ? 'The requested session is not in this Batch’s most recent 50 sessions. Choose an available session.'
              : recordsOnly
                ? 'No session recordings available.'
                : 'Select or create a Live Session.'}
          </p>
        )}
      </section>
      {editor && (
        <SessionEditor
          batch={batch}
          session={editor === 'edit' ? session : undefined}
          onClose={() => setEditor(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
