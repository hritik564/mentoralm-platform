'use client';
import Link from 'next/link';
import { useState } from 'react';
import { workspaceDestinations } from '@/lib/admin/navigation';
import { adminHref } from '@/lib/platform/domains';
import { useAdminAccess } from './AdminShell';
import { useAdminData } from './client';
import { AdminIcon } from './AdminIcon';
import { Pill, State, Table } from './Primitives';
import type { Choice, Overview } from './types';
import type { OperationalOverview } from './operational/types';

export function LearningHome({ actions }: { actions: React.ReactNode }) {
  const { permissions } = useAdminAccess();
  const overview = useAdminData<Overview>('overview');
  const queues = useAdminData<OperationalOverview>('operations/overview');
  const data = overview.data;
  const counts: Record<string, { value?: number; caption: string }> = {
    Courses: { value: data?.metrics.courses, caption: 'Published courses' },
    Batches: { value: data?.metrics.batches, caption: 'Active batches' },
    'Live Classes': {
      value: data?.metrics.sessions,
      caption: 'Scheduled sessions',
    },
    Recordings: { value: data?.readyRecordings, caption: 'Ready for review' },
  };
  const attention = [
    {
      label: 'Recordings ready for publication review',
      value: data?.readyRecordings,
      path: '/admin/learning/recordings',
      query: '',
      permission: 'BATCHES_MANAGE',
    },
    {
      label: 'Assignments awaiting review',
      value: queues.data?.pendingAssignments,
      path: '/admin/submissions',
      query: '',
      permission: 'ACADEMICS_MANAGE',
    },
    {
      label: 'Assessment responses awaiting review',
      value: queues.data?.pendingText,
      path: '/admin/attempts',
      query: '?status=PENDING',
      permission: 'ACADEMICS_MANAGE',
    },
    {
      label: 'Held sessions without attendance records',
      value: queues.data?.heldWithoutRecords,
      path: '/admin/attendance',
      query: '?status=HELD',
      permission: 'ATTENDANCE_MANAGE',
    },
    {
      label: 'Suspended certificates',
      value: queues.data?.suspendedCertificates,
      path: '/admin/certificates',
      query: '?status=SUSPENDED',
      permission: 'CERTIFICATES_MANAGE',
    },
  ].filter(
    (item) =>
      permissions.some((p) => p === item.permission) &&
      typeof item.value === 'number' &&
      item.value > 0,
  );
  return (
    <div className="learning-home">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Learning workspace</p>
          <h1>Learning</h1>
          <p>Manage courses, batches, live classes and recordings.</p>
        </div>
      </div>
      {actions}
      <State {...overview} />
      <section className="learning-primary-areas" aria-label="Learning areas">
        {workspaceDestinations('learning', permissions)
          .filter((item) => item.primary)
          .map((item) => (
            <Link
              key={item.href}
              href={adminHref(item.href)}
              className="admin-card learning-area-card"
            >
              <span className="learning-area-title">
                <AdminIcon name={item.icon} />
                <h2>{item.label}</h2>
                <AdminIcon name="arrow" />
              </span>
              <strong className="learning-area-count">
                {counts[item.label].value?.toLocaleString('en-GB') ?? '—'}
              </strong>
              <span className="admin-muted">{counts[item.label].caption}</span>
            </Link>
          ))}
      </section>
      <section
        className="admin-card learning-attention"
        aria-labelledby="learning-attention-title"
      >
        <h2 id="learning-attention-title">Needs Attention</h2>
        <State {...queues} />
        {!!attention.length && (
          <ul className="admin-attention-list">
            {attention.map((item) => (
              <li key={item.label}>
                <Link href={`${adminHref(item.path)}${item.query}`}>
                  <span>{item.label}</span>
                  <strong className="has-items">{item.value}</strong>
                  <AdminIcon name="arrow" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!attention.length &&
          !queues.loading &&
          !overview.loading &&
          !queues.error &&
          !overview.error && (
            <p className="learning-caught-up">You're all caught up.</p>
          )}
      </section>
      {permissions.includes('ACADEMICS_MANAGE') && (
        <section className="admin-card learning-current-courses">
          <header className="admin-card-heading">
            <div>
              <h2>Current courses</h2>
              <p className="admin-muted">
                Up to 5 courses from your current catalog.
              </p>
            </div>
            <Link
              className="admin-text-link"
              href={adminHref('/admin/courses')}
            >
              All Courses →
            </Link>
          </header>
          {data?.learningCourses ? (
            data.learningCourses.length ? (
              <Table
                caption="Current courses"
                headers={[
                  'Course / Program',
                  'Enrollments',
                  'Status',
                  'Action',
                ]}
              >
                {data.learningCourses.map((course) => (
                  <tr key={course.courseRef}>
                    <td>
                      <strong>{course.title}</strong>
                      <small>{course.program || 'Independent course'}</small>
                    </td>
                    <td>{course.enrollments}</td>
                    <td>
                      <Pill>{course.published ? 'Published' : 'Draft'}</Pill>
                    </td>
                    <td>
                      <Link
                        className="admin-text-link"
                        href={adminHref(`/admin/courses/${course.courseRef}`)}
                      >
                        Open Course →
                      </Link>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p className="admin-empty">
                No courses yet. Create a course to get started.
              </p>
            )
          ) : (
            <p className="admin-muted">
              {overview.error
                ? 'Courses could not be loaded.'
                : 'Loading courses…'}
            </p>
          )}
          <p className="admin-muted learning-context-note">
            Active Batch counts per course are not available in this view.
          </p>
        </section>
      )}
      {((permissions.includes('ATTENDANCE_MANAGE') &&
        !permissions.includes('BATCHES_MANAGE')) ||
        (permissions.includes('CERTIFICATES_MANAGE') &&
          !permissions.includes('ACADEMICS_MANAGE'))) && (
        <LearningContextPicker />
      )}
    </div>
  );
}

/** Narrow-role administrators retain their existing operational access without a broader page grant. */
function LearningContextPicker() {
  const { permissions } = useAdminAccess();
  const [q, setQ] = useState(''),
    [course, setCourse] = useState(''),
    [batch, setBatch] = useState('');
  const courses = useAdminData<Choice[]>(
    `choices/courses?q=${encodeURIComponent(q)}`,
  );
  const batches = useAdminData<Choice[]>(
    permissions.includes('ATTENDANCE_MANAGE')
      ? `choices/batches?q=${encodeURIComponent(q)}`
      : null,
  );
  return (
    <section className="admin-card learning-context-panel">
      <h2>Open a learning context</h2>
      <p className="admin-muted">
        Choose a Course or Batch to use your assigned review tools.
      </p>
      <div className="learning-context-picker">
        <label>
          Find a Course or Batch
          <input
            value={q}
            maxLength={100}
            onChange={(e) => {
              setQ(e.target.value);
              setCourse('');
              setBatch('');
            }}
          />
        </label>
        <label>
          Course
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Select a Course</option>
            {courses.data?.map((c) => (
              <option key={c.ref} value={c.ref}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {permissions.includes('ATTENDANCE_MANAGE') && (
          <label>
            Batch
            <select value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">Select a Batch</option>
              {batches.data?.map((b) => (
                <option key={b.ref} value={b.ref}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <State {...courses} />
      <State {...batches} />
      <div className="learning-context-actions">
        {permissions.includes('ATTENDANCE_MANAGE') && (course || batch) && (
          <Link
            className="admin-button secondary"
            href={`${adminHref('/admin/attendance')}?${new URLSearchParams({ ...(course ? { course } : {}), ...(batch ? { batch } : {}) })}`}
          >
            Open context Attendance
          </Link>
        )}
        {permissions.includes('CERTIFICATES_MANAGE') && course && (
          <Link
            className="admin-button secondary"
            href={`${adminHref('/admin/certificates')}?${new URLSearchParams({ course })}`}
          >
            Open Course Certificates
          </Link>
        )}
      </div>
    </section>
  );
}
