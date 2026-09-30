import type { EnrolledCourse } from '../../../lib/dashboard/courses';
import type { LearningLaunchRegistry } from '../../../lib/dashboard/learning-launch';
import { CourseCard } from './CourseCard';
import { CourseEmptyState } from './CourseEmptyState';

export function ContinueLearning({
  course = null,
  registry,
}: {
  course?: EnrolledCourse | null;
  registry?: LearningLaunchRegistry;
}) {
  return (
    <section
      className="d2-panel d2-learning"
      aria-labelledby="continue-learning-title"
    >
      <div className="d2-section-heading">
        <div>
          <p className="dashboard-eyebrow">Your next step</p>
          <h2 id="continue-learning-title">Continue Learning</h2>
        </div>
      </div>
      {course ? (
        <CourseCard course={course} registry={registry} resume />
      ) : (
        <CourseEmptyState
          compact
          heading="No active learning yet."
          description="Explore the programs to find your starting point."
        />
      )}
    </section>
  );
}
