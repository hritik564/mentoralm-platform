import Image from 'next/image';
import type {
  EnrolledCourse,
  ViewedCourse,
} from '../../../lib/dashboard/courses';
import { publicCourseDestination } from '../../../lib/dashboard/courses';
import {
  resolveLearningLaunch,
  type LearningLaunchRegistry,
} from '../../../lib/dashboard/learning-launch';

export function CourseCard({
  course,
  registry,
  resume = false,
}: {
  course: EnrolledCourse | ViewedCourse;
  registry?: LearningLaunchRegistry;
  resume?: boolean;
}) {
  const enrolled = course.kind === 'enrolled';
  const learning = enrolled && course.status !== 'completed';
  const destination = learning
    ? resolveLearningLaunch(course.learningTarget, registry)
    : publicCourseDestination(course.publicDestination);
  const action = learning
    ? course.status === 'in-progress' || course.lastAccessed !== null
      ? 'Continue Learning'
      : 'Open LMS'
    : 'View Course';
  const progress =
    enrolled &&
    course.progress !== null &&
    Number.isFinite(course.progress) &&
    course.progress >= 0 &&
    course.progress <= 100
      ? course.progress
      : null;
  const timestamp = enrolled ? course.lastAccessed : course.lastViewed;
  const date = timestamp ? new Date(timestamp) : null;
  return (
    <article
      className={`d2-course-card${resume ? ' d2-course-card--resume' : ''}`}
    >
      <Image
        className="d2-course-thumbnail"
        src={course.thumbnail.src}
        alt={course.thumbnail.alt}
        width={640}
        height={360}
      />
      <div className="d2-course-body">
        <p className="dashboard-eyebrow">{course.program}</p>
        <h3>{course.title}</h3>
        {enrolled ? (
          <>
            <span className="d2-course-status">
              {
                {
                  enrolled: 'Enrolled',
                  'in-progress': 'In progress',
                  completed: 'Completed',
                }[course.status]
              }
            </span>
            {progress !== null && (
              <div className="d2-course-progress">
                <label>
                  Lesson progress <strong>{progress}%</strong>
                  <progress max={100} value={progress} />
                </label>
              </div>
            )}
            {course.nextLesson && <p>Next: {course.nextLesson}</p>}
          </>
        ) : (
          <p>{course.description}</p>
        )}
        {date && !Number.isNaN(date.getTime()) && (
          <p className="d2-course-date">
            {enrolled ? 'Last accessed' : 'Last viewed'}:{' '}
            <time dateTime={date.toISOString()}>
              {date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </time>
          </p>
        )}
        {destination ? (
          <a
            className="d2-action"
            href={destination}
            aria-label={`${action}: ${course.title}`}
          >
            {action}
            <span aria-hidden="true"> →</span>
          </a>
        ) : (
          <p className="d2-unavailable">
            {learning
              ? 'Learning entry is not available yet.'
              : 'Course details are not available yet.'}
          </p>
        )}
      </div>
    </article>
  );
}
