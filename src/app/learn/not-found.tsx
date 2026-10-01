import Link from 'next/link';
import { lmsHref } from '@/lib/platform/domains';
export default function MissingCourse() {
  return (
    <section className="lms-panel lms-empty">
      <h1>Course not available</h1>
      <p>This course is not available for your account.</p>
      <Link href={lmsHref('/learn/lectures')}>Return to your courses</Link>
    </section>
  );
}
