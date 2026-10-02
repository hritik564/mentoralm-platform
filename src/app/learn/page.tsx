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
import { LmsSectionCard } from '@/components/lms/LmsPrimitives';
export default async function LmsHome() {
  return (
    <LmsBoundary
      load={async () => {
        const user = await requireStudentIdentity();
        const [identity, courses, discussion] = await Promise.all([
          getLmsIdentity(),
          (await getLearningRepository()).courses(),
          (await getDiscussions()).workspace(),
        ]);
        return (
          <>
            <div className="lms-heading">
              <div>
                <h1>Welcome{user.firstName ? `, ${user.firstName}` : ''}.</h1>
                <p>
                  A focused space for your learning journey and career growth.
                </p>
              </div>
              <LmsIdentity user={user} identity={identity} />
            </div>
            <AcademicHome
              continueLearning={
                <LmsSectionCard
                  title="Continue Learning"
                  icon="lesson"
                  action={
                    <Link href={lmsHref('/learn/lectures')}>View all →</Link>
                  }
                >
                  <LearningCourses courses={courses} />
                </LmsSectionCard>
              }
              batches={
                <LmsSectionCard title="Your batches" icon="learn">
                  <BatchList batches={identity.batches} />
                </LmsSectionCard>
              }
              discussions={
                <LmsSectionCard
                  title="Recent discussions"
                  icon="chat"
                  action={
                    <Link href={lmsHref('/learn/discussions')}>View all →</Link>
                  }
                >
                  {discussion.threads.length ? (
                    discussion.threads.slice(0, 3).map((t) => (
                      <p className="lms-home-thread" key={t.id}>
                        <Link href={lmsHref(`/learn/discussions/${t.id}`)}>
                          {t.title}
                        </Link>
                        {t.course.title}
                        {t.batch ? ` · ${t.batch.name}` : ''}
                      </p>
                    ))
                  ) : (
                    <p>No discussions in your courses yet.</p>
                  )}
                </LmsSectionCard>
              }
              support={
                <LmsSectionCard title="Need help?" icon="support">
                  <p>
                    Get help with learning access, coursework or your account.
                  </p>
                  <Link
                    className="lms-action lms-action--secondary"
                    href={lmsHref('/learn/support')}
                  >
                    Contact Support →
                  </Link>
                </LmsSectionCard>
              }
            />
          </>
        );
      }}
    />
  );
}
