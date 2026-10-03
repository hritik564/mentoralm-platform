'use client';
import Link from 'next/link';
import { useAdminAccess } from '../AdminShell';
import { useState } from 'react';
import { useAdminData } from '../client';
import { Table, Pager, Pill, State } from '../Primitives';
import { Field } from '../academic/forms';
import { adminHref } from '@/lib/platform/domains';
import type { OperationalArea } from '@/lib/admin/operational/read';
import type { Choice, StudentList } from '../types';
import type { List, OperationalOverview } from './types';
export const headings = {
  attendance: 'Attendance',
  submissions: 'Assignment Review',
  attempts: 'Quiz / Assessment Review',
  certificates: 'Certificates',
  discussions: 'Discussions',
  support: 'Support',
  communications: 'Communications',
  referrals: 'Referrals',
};
export const statuses: Record<OperationalArea, string[]> = {
  attendance: ['SCHEDULED', 'HELD', 'CANCELLED'],
  submissions: ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'ACCEPTED'],
  attempts: ['PENDING', 'REVIEWED'],
  certificates: ['ACTIVE', 'SUSPENDED', 'REVOKED'],
  discussions: ['OPEN', 'LOCKED'],
  support: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  communications: ['PENDING_PROVIDER', 'SUPPRESSED'],
  referrals: [],
};
export function OperationalList({ area }: { area: OperationalArea }) {
  const access = useAdminAccess();
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [q, setQ] = useState(''),
    [courseQuery, setCourseQuery] = useState(''),
    [batchQuery, setBatchQuery] = useState(''),
    [studentQuery, setStudentQuery] = useState('');
  const data = useAdminData<List>(
      `operations/${area}?${new URLSearchParams({ ...filters, q, page: String(page) })}`,
    ),
    courses = useAdminData<Choice[]>(
      [
        'attendance',
        'submissions',
        'attempts',
        'certificates',
        'discussions',
      ].includes(area)
        ? `choices/courses?q=${encodeURIComponent(courseQuery)}`
        : null,
    ),
    batches = useAdminData<Choice[]>(
      ['attendance', 'discussions', 'communications'].includes(area)
        ? `choices/batches?q=${encodeURIComponent(batchQuery)}`
        : null,
    ),
    students = useAdminData<StudentList>(
      access.permissions.includes('STUDENTS_MANAGE') && studentQuery
        ? `students?q=${encodeURIComponent(studentQuery)}`
        : null,
    );
  function filter(key: string, value: string) {
    setFilters((x) => ({ ...x, [key]: value }));
    setPage(1);
  }
  const courseFilter = [
      'attendance',
      'submissions',
      'attempts',
      'certificates',
      'discussions',
    ].includes(area),
    batchFilter = ['attendance', 'discussions', 'communications'].includes(
      area,
    ),
    studentFilter =
      ['submissions', 'attempts', 'certificates', 'support'].includes(area) &&
      access.permissions.includes('STUDENTS_MANAGE');
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{headings[area]}</h1>
          <p>
            {area === 'communications'
              ? 'Consent-aware Batch planning. No delivery provider is configured.'
              : area === 'referrals'
                ? 'Read-only identity and attribution history.'
                : area === 'submissions'
                  ? 'Review the latest submitted version; immutable history remains available.'
                  : area === 'attempts'
                    ? 'Submitted attempts. Only review-required text responses accept human points.'
                    : 'Operational records and authorized actions.'}
          </p>
        </div>
        {area === 'communications' && (
          <Link
            className="admin-button"
            href={adminHref('/admin/communications/new')}
          >
            Plan communication
          </Link>
        )}
        {area === 'certificates' &&
          access.permissions.includes('STUDENTS_MANAGE') && (
            <Link
              className="admin-button"
              href={adminHref('/admin/certificates/issue')}
            >
              Check policy / issue
            </Link>
          )}
      </div>
      <form
        className="academic-toolbar ops-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(String(new FormData(e.currentTarget).get('q') || ''));
          setPage(1);
        }}
      >
        <Field label={`Search ${headings[area]}`}>
          <input
            name="q"
            maxLength={100}
            placeholder={
              area === 'certificates'
                ? 'Certificate code'
                : area === 'referrals'
                  ? 'Code or Student name'
                  : 'Search title / reference'
            }
          />
        </Field>
        {!!statuses[area].length && (
          <Field label="Status">
            <select
              value={filters.status || ''}
              onChange={(e) => filter('status', e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses[area].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
        {courseFilter && (
          <>
            <Field label="Find Course">
              <input
                value={courseQuery}
                maxLength={100}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder="Course title"
              />
            </Field>
            <Field label="Course filter">
              <select
                value={filters.course || ''}
                onChange={(e) => filter('course', e.target.value)}
              >
                <option value="">All Courses</option>
                {filters.course &&
                  !courses.data?.some((c) => c.ref === filters.course) && (
                    <option value={filters.course}>Selected Course</option>
                  )}
                {courses.data?.map((c) => (
                  <option key={c.ref} value={c.ref}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        {batchFilter && (
          <>
            <Field label="Find Batch">
              <input
                value={batchQuery}
                maxLength={100}
                onChange={(e) => setBatchQuery(e.target.value)}
                placeholder="Batch name"
              />
            </Field>
            <Field label="Batch filter">
              <select
                value={filters.batch || ''}
                onChange={(e) => filter('batch', e.target.value)}
              >
                <option value="">All Batches</option>
                {filters.batch &&
                  !batches.data?.some((b) => b.ref === filters.batch) && (
                    <option value={filters.batch}>Selected Batch</option>
                  )}
                {batches.data?.map((b) => (
                  <option key={b.ref} value={b.ref}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        {studentFilter && (
          <>
            <Field label="Find Student">
              <input
                value={studentQuery}
                maxLength={100}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Name or Student ID"
              />
            </Field>
            <Field label="Student filter">
              <select
                value={filters.student || ''}
                onChange={(e) => filter('student', e.target.value)}
              >
                <option value="">All Students</option>
                {filters.student &&
                  !students.data?.rows.some(
                    (s) => s.ref === filters.student,
                  ) && (
                    <option value={filters.student}>Selected Student</option>
                  )}
                {students.data?.rows.map((s) => (
                  <option key={s.ref} value={s.ref}>
                    {s.identity.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        {area === 'attendance' && (
          <>
            <Field label="From date">
              <input
                type="date"
                value={filters.from || ''}
                onChange={(e) => filter('from', e.target.value)}
              />
            </Field>
            <Field label="To date">
              <input
                type="date"
                value={filters.to || ''}
                onChange={(e) => filter('to', e.target.value)}
              />
            </Field>
          </>
        )}
        <button className="admin-button secondary">Search</button>
      </form>
      <State {...data} />
      {data.data && (
        <section className="admin-card academic-table">
          <Table
            caption={headings[area]}
            headers={[
              'Record',
              'Context / Student',
              'Status',
              'Updated / created',
              'Details',
            ]}
          >
            {data.data.rows.map((r) => (
              <tr key={r.ref}>
                <td>
                  <Link href={adminHref(`/admin/${area}/${r.ref}`)}>
                    {r.title}
                  </Link>
                </td>
                <td>
                  {r.context}
                  {r.student && (
                    <div>
                      {access.permissions.includes('STUDENTS_MANAGE') ? (
                        <Link
                          href={adminHref(`/admin/students/${r.student.ref}`)}
                        >
                          {r.student.name}
                        </Link>
                      ) : (
                        <span>{r.student.name}</span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <Pill>{r.status}</Pill>
                </td>
                <td>{new Date(r.at).toLocaleString('en-GB')}</td>
                <td>{r.detail}</td>
              </tr>
            ))}
          </Table>
          {!data.data.rows.length && (
            <p className="admin-state">No matching records.</p>
          )}
          <Pager page={page} total={data.data.total} onPage={setPage} />
        </section>
      )}
    </>
  );
}
export function OperationalMetrics() {
  const data = useAdminData<OperationalOverview>('operations/overview');
  return (
    <section className="admin-card ops-overview">
      <h2>Operations queues</h2>
      <State {...data} />
      {data.data && (
        <div className="ops-queue-grid">
          {[
            [
              'Pending assignment reviews',
              data.data.pendingAssignments,
              'submissions',
            ],
            ['Pending text reviews', data.data.pendingText, 'attempts'],
            ['Open Support', data.data.openSupport, 'support'],
            [
              'Held sessions without records',
              data.data.heldWithoutRecords,
              'attendance',
            ],
            [
              'Suspended certificates',
              data.data.suspendedCertificates,
              'certificates',
            ],
          ]
            .filter(([, count]) => count !== undefined)
            .map(([label, count, area]) => (
              <Link key={String(area)} href={adminHref(`/admin/${area}`)}>
                <strong>{count}</strong>
                <span>{label}</span>
              </Link>
            ))}
          {data.data.deliveries?.map((d) => (
            <div key={d.status}>
              <strong>{d.count}</strong>
              <span>{d.status} deliveries</span>
            </div>
          ))}
        </div>
      )}
      <p className="admin-muted">
        Counts describe recorded state, without SLA or urgency estimates.
      </p>
    </section>
  );
}
