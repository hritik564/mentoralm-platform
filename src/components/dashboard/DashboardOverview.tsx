import Link from 'next/link';
import type { AccountIdentity } from '@/components/auth/UserAvatar';
import { Menti } from '@/components/menti/Menti';
import {
  exploreProgramsDestination,
  type DashboardCourses,
} from '@/lib/dashboard/courses';
import { DashboardIcon } from './DashboardIcon';
import { ContinueLearning } from './courses/ContinueLearning';
import { CourseCard } from './courses/CourseCard';
import { CourseEmptyState } from './courses/CourseEmptyState';

export function DashboardOverview({
  user,
  courses,
  resourcesAvailable = false,
}: {
  user: AccountIdentity;
  courses: DashboardCourses;
  resourcesAvailable?: boolean;
}) {
  // Preserve the domain adapter's ordering; Dashboard does not calculate recency/progress.
  const active = courses.enrolled.find(
    (course) =>
      course.status !== 'completed' &&
      (course.learningTarget !== null ||
        (course.status === 'in-progress' && course.progress !== null)),
  );
  const preview = [...courses.enrolled, ...courses.viewed].slice(0, 2);
  return (
    <>
      <section className="dashboard-welcome" aria-labelledby="welcome-title">
        <div>
          <p className="dashboard-eyebrow">Your workspace</p>
          <h1 id="welcome-title">
            Welcome back{user.firstName ? `, ${user.firstName}` : ''}.
          </h1>
          <p>Explore your next step and pick up where you left off.</p>
        </div>
        <div className="dashboard-menti">
          <Menti />
          <p>
            Ready when you are.
            <br />
            <span>Menti · Your future AI guide</span>
          </p>
        </div>
      </section>
      <div className="dashboard-overview-primary">
        <ContinueLearning course={active} />
        <section className="d2-panel" aria-labelledby="my-courses-title">
          <div className="d2-section-heading">
            <div>
              <p className="dashboard-eyebrow">Explore & learn</p>
              <h2 id="my-courses-title">My Courses</h2>
            </div>
            <Link
              prefetch={false}
              className="d2-text-action"
              href="/dashboard/courses"
            >
              View My Courses <span aria-hidden="true">→</span>
            </Link>
          </div>
          {preview.length ? (
            <div className="d2-course-grid">
              {preview.map((course) => (
                <CourseCard
                  key={`${course.kind}-${course.id}`}
                  course={course}
                />
              ))}
            </div>
          ) : (
            <CourseEmptyState
              compact
              heading="Your course space starts here."
              description="Courses you view or enroll in will appear here."
            />
          )}
        </section>
      </div>
      <section className="d2-shortcuts" aria-labelledby="shortcuts-title">
        <h2 id="shortcuts-title">Useful shortcuts</h2>
        <div className="d2-shortcut-grid">
          {(
            [
              {
                label: 'Explore Programs',
                href: exploreProgramsDestination,
                icon: 'overview',
              },
              {
                label: 'My Courses',
                href: '/dashboard/courses',
                icon: 'courses',
              },
              {
                label: 'Resources',
                href: '/dashboard/resources',
                icon: 'resources',
              },
              { label: 'Support', href: '/dashboard/support', icon: 'support' },
            ] as const
          ).map((item) => (
            <Link key={item.label} prefetch={false} href={item.href}>
              <DashboardIcon name={item.icon} />
              <span>{item.label}</span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>
      <section
        className="d2-resource-boundary"
        aria-labelledby="resource-boundary-title"
      >
        <DashboardIcon name="resources" />
        <div>
          <h2 id="resource-boundary-title">
            {resourcesAvailable
              ? 'Your resources are available'
              : 'A place for useful resources'}
          </h2>
          <p>
            {resourcesAvailable
              ? 'Visit Resources to browse the materials shared with you.'
              : 'Resources shared with you will appear in your library.'}
          </p>
        </div>
        <Link href="/dashboard/resources" className="d2-text-action">
          View Resources →
        </Link>
      </section>
    </>
  );
}
