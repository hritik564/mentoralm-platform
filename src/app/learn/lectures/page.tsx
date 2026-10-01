import { getAuthorizedCourses } from '@/lib/lms/services';
import { CourseList } from '@/components/lms/LmsViews';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
export default function Lectures() {
  return (
    <LmsBoundary
      load={async () => (
        <>
          <p className="lms-eyebrow">Learn</p>
          <h1>Lectures</h1>
          <p className="lms-intro">
            Explore your enrolled courses and published course outlines.
          </p>
          <section className="lms-panel">
            <h2>Your courses</h2>
            <CourseList courses={await getAuthorizedCourses()} />
          </section>
        </>
      )}
    />
  );
}
