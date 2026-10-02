import Link from 'next/link';
import { LmsStatusBadge } from './LmsPrimitives';
import { lmsHref, websiteHref } from '@/lib/platform/domains';
import { UserAvatar, type AccountIdentity } from '../auth/UserAvatar';
import type {
  getLmsIdentity,
  getAuthorizedCourses,
  getCourseStructure,
} from '@/lib/lms/services';
import type { LmsBatch } from '@/lib/lms/batches';
type Identity = Awaited<ReturnType<typeof getLmsIdentity>>;
type Courses = Awaited<ReturnType<typeof getAuthorizedCourses>>;
export function LmsIdentity({
  user,
  identity,
}: {
  user: AccountIdentity;
  identity: Identity;
}) {
  return (
    <section className="lms-identity" aria-label="Student identity">
      <UserAvatar user={user} />
      <div>
        <strong>{user.name || 'Your student account'}</strong>
        <span>
          Student ID <b>{identity.studentId}</b>
        </span>
      </div>
      <div className="lms-current">
        <span>Current batch</span>
        {identity.currentBatch ? (
          <>
            <strong>{identity.currentBatch.name}</strong>
            <span>{identity.currentBatch.code}</span>
          </>
        ) : (
          <strong>
            {identity.batches.length ? 'No active batch' : 'Batch not assigned'}
          </strong>
        )}
      </div>
    </section>
  );
}
export function CourseList({ courses }: { courses: Courses }) {
  return courses.length ? (
    <ul className="lms-list">
      {courses.map((course) => (
        <li key={course.id}>
          <div>
            <span className="lms-eyebrow">{course.program || 'Course'}</span>
            <h3>{course.title}</h3>
            <p>{course.description}</p>
          </div>
          <Link
            className="lms-action"
            href={lmsHref(`/learn/courses/${course.id}`)}
            prefetch={false}
            aria-label={`Open course: ${course.title}`}
          >
            Open course <span aria-hidden="true">↗</span>
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <div className="lms-empty">
      <h3>No courses available yet</h3>
      <p>
        Your enrolled courses will appear here when learning access is
        available.
      </p>
      <Link href={websiteHref('/dashboard/courses')}>View My Courses ↗</Link>
    </div>
  );
}
export function BatchList({ batches }: { batches: LmsBatch[] }) {
  return batches.length ? (
    <ul className="lms-list lms-batches">
      {batches.map((batch) => (
        <li key={batch.code}>
          <div>
            <h3>{batch.name}</h3>
            <p>
              {batch.code}
              {batch.scope ? ` · ${batch.scope}` : ''}
            </p>
            <span>
              {batch.instructors} instructor{batch.instructors === 1 ? '' : 's'}{' '}
              assigned
            </span>
          </div>
          <LmsStatusBadge
            status={
              batch.membershipStatus === 'INACTIVE'
                ? 'Inactive membership'
                : batch.status
            }
          />
        </li>
      ))}
    </ul>
  ) : (
    <p className="lms-empty">
      Batch not assigned. Your delivery groups will appear here once assigned.
    </p>
  );
}
export function FutureSurface({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <p className="lms-eyebrow">Learning workspace</p>
      <h1>{title}</h1>
      <section className="lms-panel lms-empty">
        <h2>
          {title} {title === 'Chat' ? 'is' : 'are'} not available yet
        </h2>
        <p>{description}</p>
        <span className="lms-status">Coming in a later phase</span>
      </section>
    </>
  );
}
const labels = {
  LESSON: 'Lesson',
  QUIZ: 'Quiz',
  ASSIGNMENT: 'Assignment',
  RESOURCE: 'Resource',
  LIVE_SESSION: 'Live session',
  ASSESSMENT: 'Assessment',
};
export function CourseStructure({
  course,
}: {
  course: Awaited<ReturnType<typeof getCourseStructure>>;
}) {
  return (
    <>
      <Link className="lms-back" href={lmsHref('/learn/lectures')}>
        ← All courses
      </Link>
      <p className="lms-eyebrow">{course.program?.title || 'Course'}</p>
      <h1>{course.title}</h1>
      <p className="lms-intro">{course.description}</p>
      <p className="lms-note">
        Course outline. Learning activities will become available in later
        phases.
      </p>
      {course.sections.length ? (
        course.sections.map((section) => (
          <section className="lms-panel lms-section" key={section.position}>
            <header>
              <span className="lms-eyebrow">Section {section.position}</span>
              <h2>{section.title}</h2>
              {section.description && <p>{section.description}</p>}
            </header>
            {section.items.length ? (
              <ol className="lms-item-list">
                {section.items.map((item) => (
                  <li key={item.position}>
                    <span className="lms-item-position" aria-hidden="true">
                      {String(item.position).padStart(2, '0')}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{labels[item.type]}</span>
                    </div>
                    <span className="lms-status">Not available yet</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="lms-empty">No published learning items yet.</p>
            )}
          </section>
        ))
      ) : (
        <section className="lms-panel lms-empty">
          <h2>Course outline is being prepared</h2>
          <p>Published sections and learning items will appear here.</p>
        </section>
      )}
    </>
  );
}
