import Link from 'next/link';
import { lmsHref } from '@/lib/platform/domains';
import { AcademicHome } from '@/components/lms/AcademicHome';
import { LearningCourses } from '@/components/lms/LearningLists';
import { requireStudentIdentity } from '@/lib/auth/session';
import {
  getLmsIdentity,
  getLearningRepository,
  getDiscussions,
} from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { LmsIdentity, BatchList } from '@/components/lms/LmsViews';
export default async function LmsHome() {
  const user = await requireStudentIdentity();
  return (
    <LmsBoundary
      load={async () => {
        const [identity, courses, discussion] = await Promise.all([
          getLmsIdentity(),
          (await getLearningRepository()).courses(),
          (await getDiscussions()).workspace(),
        ]);
        return (
          <>
            <div className="lms-heading">
              <div>
                <p className="lms-eyebrow">Your learning workspace</p>
                <h1>Welcome{user.firstName ? `, ${user.firstName}` : ''}.</h1>
                <p>A focused space for your next step.</p>
              </div>
              <span className="lms-status">Student workspace</span>
            </div>
            <LmsIdentity user={user} identity={identity} />
            <div className="lms-home-grid">
              <section className="lms-panel">
                <header className="lms-panel-heading">
                  <h2>Continue Learning</h2>
                </header>
                <LearningCourses courses={courses} />
              </section>
              <section className="lms-panel">
                <header className="lms-panel-heading">
                  <h2>Your batches</h2>
                </header>
                <BatchList batches={identity.batches} />
              </section>
            </div>
            <AcademicHome />
            <section className="lms-panel lms-upcoming">
              <h2>Recent discussions</h2>
              {discussion.threads.length ? (
                discussion.threads.slice(0, 3).map((t) => (
                  <p key={t.id}>
                    <Link href={lmsHref(`/learn/discussions/${t.id}`)}>
                      {t.title}
                    </Link>{' '}
                    · {t.course.title}
                    {t.batch ? ` · ${t.batch.name}` : ''}
                  </p>
                ))
              ) : (
                <p>No discussions in your courses yet.</p>
              )}
              <Link href={lmsHref('/learn/discussions')}>
                Open discussions →
              </Link>
            </section>
          </>
        );
      }}
    />
  );
}
