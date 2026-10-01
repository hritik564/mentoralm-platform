import Link from 'next/link';
import type { LearningCourse, LearningRepository } from '@/lib/lms/learning';
import { lmsHref, learningItemHref } from '@/lib/platform/domains';
export function LearningCourses({ courses }: { courses: LearningCourse[] }) {
  return courses.length ? (
    <ul className="lms-list l2-course-list">
      {courses.map((course) => (
        <li key={course.id}>
          <div>
            <span className="lms-eyebrow">{course.program || 'Course'}</span>
            <h3>{course.title}</h3>
            <p>
              {course.progress.percentage === null
                ? 'No required learning items yet'
                : `${course.academicCompletionEnabled || course.hasAcademicItems ? 'Course' : 'Lesson'} progress ${course.progress.percentage}% · ${course.progress.completedItems}/${course.progress.requiredItems} required ${course.hasAcademicItems ? 'learning items' : 'lessons'}`}
            </p>
            {course.progress.nextItem && (
              <p>Next: {course.progress.nextItem.title}</p>
            )}
            {course.progress.lastAccessedAt && (
              <small>
                Last accessed{' '}
                <time dateTime={course.progress.lastAccessedAt}>
                  {new Date(course.progress.lastAccessedAt).toLocaleDateString(
                    'en-US',
                    { timeZone: 'UTC' },
                  )}
                </time>
              </small>
            )}
          </div>
          <Link
            className="lms-action"
            prefetch={false}
            href={
              course.progress.nextItem
                ? learningItemHref(course.id, course.progress.nextItem)
                : lmsHref(`/learn/courses/${course.id}`)
            }
          >
            Continue Learning<span className="sr-only">: {course.title}</span> →
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <p className="lms-empty">No enrolled courses with learning access yet.</p>
  );
}
export function LearningResources({
  resources,
}: {
  resources: Awaited<ReturnType<LearningRepository['resources']>>;
}) {
  return resources.length ? (
    <ul className="lms-list">
      {resources.map((resource) => (
        <li key={resource.id}>
          <div>
            <span className="lms-eyebrow">
              {resource.course} · {resource.section}
            </span>
            <h3>{resource.title}</h3>
            {resource.description && <p>{resource.description}</p>}
          </div>
          {resource.available ? (
            <div className="l2-resource-actions">
              <a
                href={`/api/lms/courses/${resource.courseId}/resources/${resource.id}/media`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open resource ↗
              </a>
              {resource.downloadAllowed && (
                <a
                  href={`/api/lms/courses/${resource.courseId}/resources/${resource.id}/media?download=1`}
                >
                  Download
                </a>
              )}
            </div>
          ) : (
            <span>Content unavailable</span>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className="lms-empty">
      No learning resources available yet. Course materials shared with you will
      appear here.
    </p>
  );
}
