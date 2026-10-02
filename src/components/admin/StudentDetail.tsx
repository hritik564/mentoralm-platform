'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAdminData, useAdminMutation } from './client';
import {
  State,
  Tabs,
  Table,
  DateText,
  Pill,
  AccessPill,
  AdminDialog,
} from './Primitives';
import { adminHref } from '@/lib/platform/domains';
import type { StudentDetail as Detail, Choice, BatchList } from './types';
export function AdminStudentDetail({ refId }: { refId: string }) {
  const { data, error, loading, reload } = useAdminData<Detail>(
      `students/${refId}`,
    ),
    mutation = useAdminMutation(reload),
    [adding, setAdding] = useState<'enrollment' | 'batch' | null>(null);
  return (
    <>
      <Link className="admin-back" href={adminHref('/admin/students')}>
        ← Back to Students
      </Link>
      <State {...{ loading, error, reload }} />
      {data && (
        <>
          <div className="admin-detail-heading">
            <span className="admin-avatar" aria-hidden="true">
              {data.identity.name.slice(0, 1)}
            </span>
            <div>
              <h1>{data.identity.name}</h1>
              <p>
                {data.studentId || 'Student ID not assigned'} <span>·</span>{' '}
                {data.identity.email || 'Email unavailable'} <span>·</span>{' '}
                Joined <DateText value={data.created} />
              </p>
            </div>
            <Pill>{data.identity.status}</Pill>
          </div>
          <p role="status" className="admin-save-notice">
            {mutation.notice}
          </p>
          <Tabs labels={['Overview', 'Enrollments', 'Batches', 'Audit']}>
            {(tab) =>
              tab === 'Overview' ? (
                <div className="admin-grid">
                  <section className="admin-card">
                    <h2>Personal information</h2>
                    <dl className="admin-key-values">
                      {[
                        ['Full name', data.identity.name],
                        ['Email', data.identity.email || '—'],
                        ['Phone', data.identity.phone || '—'],
                        ['Account', data.identity.status],
                        ['Education', data.profile?.educationLevel || '—'],
                        ['Institution', data.profile?.institution || '—'],
                        ['Graduation', data.profile?.graduationYear || '—'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className="admin-card">
                    <h2>LMS access</h2>
                    <label className="admin-access-label">
                      Individual override
                      <select
                        aria-label="Individual LMS override"
                        value={data.override}
                        disabled={mutation.busy}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (
                            value === 'DISABLED' &&
                            !confirm(
                              'Disable this student’s LMS access? Course Enrollments and Batch memberships will remain unchanged.',
                            )
                          )
                            return;
                          void mutation.save(`students/${data.ref}/access`, {
                            value,
                          });
                        }}
                      >
                        {['INHERIT', 'ENABLED', 'DISABLED'].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <dl className="admin-key-values">
                      <div>
                        <dt>Effective access</dt>
                        <dd>
                          <AccessPill enabled={data.effective.enabled} />
                        </dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{data.effective.source}</dd>
                      </div>
                    </dl>
                    <p className="admin-callout">
                      An individual override takes precedence over Batch access.
                      Enrollment is checked separately.
                    </p>
                  </section>
                  <section className="admin-card">
                    <h2>Learning identity</h2>
                    <dl className="admin-key-values">
                      <div>
                        <dt>Student ID</dt>
                        <dd>{data.studentId || 'Not assigned'}</dd>
                      </div>
                      <div>
                        <dt>Current Batch</dt>
                        <dd>{data.currentBatch || '—'}</dd>
                      </div>
                      <div>
                        <dt>Joined</dt>
                        <dd>
                          <DateText value={data.created} />
                        </dd>
                      </div>
                      <div>
                        <dt>Enrollments</dt>
                        <dd>{data.counts.enrollments}</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="admin-card">
                    <header className="admin-card-heading">
                      <h2>Batch membership</h2>
                      <button
                        className="admin-button secondary"
                        onClick={() => setAdding('batch')}
                      >
                        ＋ Add to Batch
                      </button>
                    </header>
                    {data.memberships.length ? (
                      data.memberships.map((m) => (
                        <div className="admin-attention-row" key={m.batchRef}>
                          <Link
                            href={adminHref(`/admin/batches/${m.batchRef}`)}
                          >
                            {m.name}
                          </Link>
                          <Pill>{m.status}</Pill>
                        </div>
                      ))
                    ) : (
                      <p className="admin-muted">No Batch memberships.</p>
                    )}
                  </section>
                </div>
              ) : tab === 'Enrollments' ? (
                <section className="admin-card">
                  <header className="admin-card-heading">
                    <h2>Course Enrollments</h2>
                    <button
                      className="admin-button"
                      onClick={() => setAdding('enrollment')}
                    >
                      ＋ Enroll in Course
                    </button>
                  </header>
                  <p className="admin-muted">
                    Removing Enrollment revokes Course access. Learning history
                    is retained; completion is determined by the LMS.
                  </p>
                  <Table
                    caption="Student Enrollments"
                    headers={['Course', 'Status', 'Enrolled', 'Action']}
                  >
                    {data.enrollments.map((e) => (
                      <tr key={e.courseRef}>
                        <td>{e.title}</td>
                        <td>
                          {e.status === 'COMPLETED' ? (
                            <Pill>COMPLETED</Pill>
                          ) : (
                            <select
                              aria-label={`Enrollment status for ${e.title}`}
                              value={e.status}
                              disabled={mutation.busy}
                              onChange={(event) =>
                                void mutation.save(
                                  `students/${data.ref}/enrollments`,
                                  {
                                    courseId: e.courseRef,
                                    value: event.target.value,
                                  },
                                )
                              }
                            >
                              <option>ENROLLED</option>
                              <option>IN_PROGRESS</option>
                            </select>
                          )}
                        </td>
                        <td>
                          <DateText value={e.joined} />
                        </td>
                        <td>
                          <button
                            className="admin-danger-button"
                            disabled={mutation.busy}
                            onClick={() => {
                              if (confirm(`Remove Enrollment in ${e.title}?`))
                                void mutation.save(
                                  `students/${data.ref}/enrollments`,
                                  { courseId: e.courseRef, value: null },
                                );
                            }}
                          >
                            Remove Enrollment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Table>
                  {!data.enrollments.length && (
                    <p className="admin-empty">No Course Enrollments.</p>
                  )}
                </section>
              ) : tab === 'Batches' ? (
                <section className="admin-card">
                  <header className="admin-card-heading">
                    <h2>Batch membership</h2>
                    <button
                      className="admin-button"
                      onClick={() => setAdding('batch')}
                    >
                      ＋ Add to Batch
                    </button>
                  </header>
                  <Table
                    caption="Student Batch membership"
                    headers={[
                      'Batch',
                      'Status',
                      'Joined',
                      'Left',
                      'Batch LMS',
                      'Action',
                    ]}
                  >
                    {data.memberships.map((m) => (
                      <tr key={m.batchRef}>
                        <td>
                          <Link
                            href={adminHref(`/admin/batches/${m.batchRef}`)}
                          >
                            {m.name}
                          </Link>
                        </td>
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
                          <AccessPill enabled={m.batchAccess} />
                        </td>
                        <td>
                          <button
                            className="admin-button secondary"
                            disabled={mutation.busy}
                            onClick={() => {
                              if (
                                m.status === 'ACTIVE' &&
                                !confirm(
                                  'Deactivate this Batch membership? Enrollment remains unchanged.',
                                )
                              )
                                return;
                              void mutation.save(
                                `batches/${m.batchRef}/memberships`,
                                {
                                  userId: data.ref,
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
                  <p className="admin-muted">
                    Membership and Enrollment are separate. Reactivation
                    preserves the original join date; changes are audited.
                  </p>
                </section>
              ) : (
                <section className="admin-card">
                  <h2>Recent student audit</h2>
                  {data.audit.length ? (
                    data.audit.map((e, i) => (
                      <div className="admin-activity" key={i}>
                        <span>{e.action}</span>
                        <DateText value={e.at} />
                      </div>
                    ))
                  ) : (
                    <p className="admin-muted">
                      No recent student audit events.
                    </p>
                  )}
                </section>
              )
            }
          </Tabs>
          {adding && (
            <StudentAdder
              kind={adding}
              student={data}
              onClose={() => setAdding(null)}
              onSaved={reload}
            />
          )}
        </>
      )}
    </>
  );
}
function StudentAdder({
  kind,
  student,
  onClose,
  onSaved,
}: {
  kind: 'enrollment' | 'batch';
  student: Detail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState(''),
    courses = useAdminData<Choice[]>(
      kind === 'enrollment'
        ? `choices/courses?q=${encodeURIComponent(query)}`
        : null,
    ),
    batches = useAdminData<BatchList>(
      kind === 'batch' ? `batches?q=${encodeURIComponent(query)}` : null,
    ),
    mutation = useAdminMutation(onSaved);
  const choices =
    kind === 'enrollment'
      ? courses.data || []
      : batches.data?.rows.map((b) => ({ ref: b.ref, label: b.name })) || [];
  return (
    <AdminDialog
      title={kind === 'enrollment' ? 'Enroll in Course' : 'Add to Batch'}
      onClose={onClose}
    >
      <div className="admin-form">
        <label>
          Search {kind === 'enrollment' ? 'Courses' : 'Batches'}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected('');
            }}
            maxLength={100}
          />
        </label>
        <label>
          {kind === 'enrollment' ? 'Course' : 'Batch'}
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
          Search narrows the bounded results. Joining a Batch never creates
          Enrollment.
        </p>
        <p role="status">{mutation.notice}</p>
        <State
          loading={courses.loading || batches.loading}
          error={courses.error || batches.error}
          reload={() => {
            courses.reload();
            batches.reload();
          }}
        />
        <div className="admin-actions">
          <button
            className="admin-button"
            disabled={!selected || mutation.busy}
            onClick={async () => {
              const r = await mutation.save(
                kind === 'enrollment'
                  ? `students/${student.ref}/enrollments`
                  : `batches/${selected}/memberships`,
                kind === 'enrollment'
                  ? { courseId: selected, value: 'ENROLLED' }
                  : { userId: student.ref, status: 'ACTIVE' },
              );
              if (r) onClose();
            }}
          >
            Confirm
          </button>
          <button className="admin-button secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}
