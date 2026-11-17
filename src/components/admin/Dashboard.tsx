'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminHref } from '@/lib/platform/domains';
import { useAdminAccess, useAdminIdentity } from './AdminShell';
import { useAdminData } from './client';
import { AdminIcon } from './AdminIcon';
import { AdminQuickActions } from './Workspaces';
import { Pill, State, Table } from './Primitives';
import type { Overview } from './types';
import type { OperationalOverview } from './operational/types';
function useGreeting() {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setHour(new Date().getHours());
    const frame = requestAnimationFrame(update);
    const timer = setInterval(update, 60000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, []);
  return hour === null
    ? 'Welcome back'
    : hour < 12
      ? 'Good Morning'
      : hour < 18
        ? 'Good Afternoon'
        : 'Good Evening';
}
export function AdminDashboard() {
  const identity = useAdminIdentity(),
    { permissions } = useAdminAccess(),
    greeting = useGreeting();
  const overview = useAdminData<Overview>('overview'),
    queues = useAdminData<OperationalOverview>('operations/overview');
  const data = overview.data;
  const count = (value: number) => value.toLocaleString('en-GB');
  const metrics = data
    ? [
        {
          label: 'Students',
          value: data.metrics.students,
          caption: 'Registered student accounts',
          icon: 'students',
          path: '/admin/students',
        },
        {
          label: 'Active Batches',
          value: data.metrics.batches,
          caption: 'Currently active cohorts',
          icon: 'batches',
          path: '/admin/batches',
        },
        {
          label: 'Courses',
          value: data.metrics.courses,
          caption: 'Published learning courses',
          icon: 'courses',
          path: '/admin/courses',
        },
        {
          label: 'Live Classes',
          value: data.metrics.sessions,
          caption: 'Scheduled sessions',
          icon: 'calendar',
          path: '/admin/learning/classes',
        },
        {
          label: 'Recordings',
          value: data.metrics.recordings,
          caption: 'Published recordings',
          icon: 'video',
          path: '/admin/learning/recordings',
        },
        {
          label: 'Enrollments',
          value: data.metrics.enrollments,
          caption: 'Enrolled or in progress',
          icon: 'check',
          path: '/admin/students',
        },
        ...(!permissions.includes('STUDENTS_MANAGE') &&
        !permissions.includes('BATCHES_MANAGE') &&
        !permissions.includes('ACADEMICS_MANAGE')
          ? [
              {
                label: 'Open Support',
                value: data.metrics.support,
                caption: 'Awaiting resolution',
                icon: 'inbox',
                path: '/admin/support',
              },
            ]
          : []),
      ].filter((m) => m.value !== undefined)
    : [];
  const attention = [
    {
      label: 'Support tickets awaiting resolution',
      value: data?.metrics.support,
      path: '/admin/support',
      query: '',
      icon: 'inbox',
    },
    {
      label: 'Students without LMS access',
      value:
        data?.metrics.students !== undefined &&
        data.metrics.enabled !== undefined
          ? Math.max(0, data.metrics.students - data.metrics.enabled)
          : undefined,
      path: '/admin/students',
      query: '?access=disabled',
      icon: 'students',
    },
    {
      label: 'Assignments requiring review',
      value: queues.data?.pendingAssignments,
      path: '/admin/submissions',
      query: '',
      icon: 'document',
    },
    {
      label: 'Assessment responses requiring review',
      value: queues.data?.pendingText,
      path: '/admin/attempts',
      query: '',
      icon: 'check',
    },
    {
      label: 'Held sessions without attendance records',
      value: queues.data?.heldWithoutRecords,
      path: '/admin/attendance',
      query: '',
      icon: 'calendar',
    },
    {
      label: 'Suspended certificates',
      value: queues.data?.suspendedCertificates,
      path: '/admin/certificates',
      query: '',
      icon: 'award',
    },
    {
      label: 'Recordings ready for publication review',
      value: data?.readyRecordings,
      path: '/admin/learning/recordings',
      query: '',
      icon: 'video',
    },
  ].filter((a) => a.value !== undefined);
  return (
    <>
      <div className="admin-page-heading admin-dashboard-heading">
        <div>
          <p className="admin-eyebrow">Overview</p>
          <h1>
            {greeting},{' '}
            {identity.firstName || identity.name.split(' ')[0] || 'Admin'}
            <span className="admin-greeting-dot">.</span>
          </h1>
          <p>Here&apos;s what&apos;s happening on MentoraLM today.</p>
        </div>
        <span className="admin-dashboard-label">
          <span /> Admin Console
        </span>
      </div>
      <AdminQuickActions />
      <State {...overview} />
      {!!metrics.length && (
        <section
          className="admin-summary-metrics"
          aria-label="Platform summary"
        >
          {metrics.map((m) => (
            <Link
              className="admin-card admin-summary-metric"
              key={m.label}
              href={adminHref(m.path)}
            >
              <span className="admin-metric-top">
                <span>{m.label}</span>
                <AdminIcon name={m.icon} />
              </span>
              <strong>{count(m.value!)}</strong>
              <small>{m.caption}</small>
            </Link>
          ))}
        </section>
      )}
      <div className="admin-dashboard-grid">
        {permissions.includes('BATCHES_MANAGE') && (
          <section className="admin-card admin-today">
            <header className="admin-card-heading">
              <div>
                <h2>Today&apos;s Classes</h2>
                <p className="admin-muted">
                  Scheduled sessions · UTC · up to 5
                </p>
              </div>
              <Link
                className="admin-text-link"
                href={adminHref('/admin/learning/classes')}
              >
                View classes →
              </Link>
            </header>
            {data?.todaySessions ? (
              data.todaySessions.rows.length ? (
                <ul className="admin-class-list">
                  {data.todaySessions.rows.map((session) => (
                    <li key={session.ref}>
                      <time dateTime={session.startsAt}>
                        {new Date(session.startsAt).toLocaleTimeString(
                          'en-GB',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'UTC',
                          },
                        )}
                        <small>UTC</small>
                      </time>
                      <div>
                        <Link
                          href={`${adminHref(`/admin/batches/${session.batchRef}`)}?tab=sessions`}
                          className="admin-row-link"
                        >
                          {session.title}
                        </Link>
                        <p>{session.batchName}</p>
                      </div>
                      <Pill>
                        {session.status.charAt(0) +
                          session.status.slice(1).toLowerCase()}
                      </Pill>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="admin-dashboard-empty">
                  <span className="admin-empty-icon">
                    <AdminIcon name="calendar" />
                  </span>
                  <h3>No live classes scheduled today.</h3>
                  <p>Your next learning moment starts with a plan.</p>
                  <Link
                    className="admin-text-link"
                    href={adminHref('/admin/learning/classes')}
                  >
                    Schedule a class →
                  </Link>
                </div>
              )
            ) : overview.error ? (
              <p className="admin-muted">The schedule could not be loaded.</p>
            ) : (
              <p className="admin-state" role="status">
                Loading today&apos;s classes…
              </p>
            )}
          </section>
        )}
        {[
          'STUDENTS_MANAGE',
          'SUPPORT_MANAGE',
          'ACADEMICS_MANAGE',
          'BATCHES_MANAGE',
          'ATTENDANCE_MANAGE',
          'CERTIFICATES_MANAGE',
        ].some((p) => permissions.some((v) => v === p)) && (
          <section className="admin-card admin-needs-attention">
            <header className="admin-card-heading">
              <div>
                <h2>Needs Attention</h2>
                <p className="admin-muted">A clear next step for your team.</p>
              </div>
              <span className="admin-attention-indicator" aria-hidden="true" />
            </header>
            <State {...queues} />
            {attention.length ? (
              <ul className="admin-attention-list">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link href={`${adminHref(a.path)}${a.query}`}>
                      <AdminIcon name={a.icon} />
                      <span>{a.label}</span>
                      <strong className={a.value ? 'has-items' : ''}>
                        {count(a.value!)}
                      </strong>
                      <AdminIcon name="arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              !queues.loading &&
              !overview.loading && (
                <p className="admin-muted">
                  No queue counts are available for your current permissions.
                </p>
              )
            )}
            {data?.metrics.enabled !== undefined && (
              <p className="admin-attention-footnote">
                Effective LMS access: {count(data.metrics.enabled)}
              </p>
            )}
          </section>
        )}
        {permissions.includes('ACADEMICS_MANAGE') && (
          <section className="admin-card admin-learning-glance">
            <header className="admin-card-heading">
              <div>
                <h2>Learning at a Glance</h2>
                <p className="admin-muted">Your current course catalog.</p>
              </div>
              <Link
                className="admin-text-link"
                href={adminHref('/admin/learning')}
              >
                View All Courses →
              </Link>
            </header>
            {data?.learningCourses ? (
              data.learningCourses.length ? (
                <Table
                  caption="Learning at a glance"
                  headers={['Course / Program', 'Enrolled', 'Status']}
                >
                  {data.learningCourses.map((course) => (
                    <tr key={course.courseRef}>
                      <td>
                        <Link
                          className="admin-row-link"
                          href={adminHref(`/admin/courses/${course.courseRef}`)}
                        >
                          {course.title}
                        </Link>
                        <small>{course.program || 'Independent course'}</small>
                      </td>
                      <td>{count(course.enrollments)}</td>
                      <td>
                        <Pill tone={course.published ? 'good' : 'neutral'}>
                          {course.published ? 'Published' : 'Draft'}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <div className="admin-dashboard-empty">
                  <span className="admin-empty-icon">
                    <AdminIcon name="courses" />
                  </span>
                  <h3>Your learning catalog starts here.</h3>
                  <p>Create a course to shape your next learning experience.</p>
                  <Link
                    className="admin-text-link"
                    href={`${adminHref('/admin/courses')}?create=course`}
                  >
                    Create Course →
                  </Link>
                </div>
              )
            ) : (
              <p className="admin-muted">
                {overview.error
                  ? 'The course catalog could not be loaded.'
                  : 'Loading courses…'}
              </p>
            )}
          </section>
        )}
        {permissions.includes('AUDIT_VIEW') && (
          <section className="admin-card admin-recent-activity">
            <header className="admin-card-heading">
              <div>
                <h2>Recent Activity</h2>
                <p className="admin-muted">
                  The latest recorded platform updates.
                </p>
              </div>
              <Link
                className="admin-text-link"
                href={adminHref('/admin/audit')}
              >
                View audit log →
              </Link>
            </header>
            {data ? (
              data.events.length ? (
                <ol className="admin-activity-list">
                  {data.events.map((event, index) => (
                    <li key={`${event.at}-${index}`}>
                      <span className="admin-activity-dot" />
                      <div>
                        <p>{event.action}</p>
                        <time dateTime={event.at}>
                          {new Date(event.at).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="admin-dashboard-empty">
                  No audit activity has been recorded yet.
                </p>
              )
            ) : (
              <p className="admin-muted">
                {overview.error
                  ? 'Recent activity could not be loaded.'
                  : 'Loading activity…'}
              </p>
            )}
          </section>
        )}
        {queues.data?.deliveries && (
          <section className="admin-card admin-delivery-summary">
            <h2>Communication plans</h2>
            <p className="admin-muted">
              Recorded delivery states. Provider sending remains separate.
            </p>
            <div className="admin-delivery-counts">
              {queues.data.deliveries.length ? (
                queues.data.deliveries.map((delivery) => (
                  <Link
                    key={delivery.status}
                    href={adminHref('/admin/communications')}
                  >
                    <strong>{count(delivery.count)}</strong>
                    <span>
                      {delivery.status === 'PENDING_PROVIDER'
                        ? 'Awaiting provider'
                        : 'Suppressed'}
                    </span>
                  </Link>
                ))
              ) : (
                <p>No delivery plans recorded.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
