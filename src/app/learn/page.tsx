import { LearningCourses } from '@/components/lms/LearningLists';
import { requireStudentIdentity } from '@/lib/auth/session';
import { getLmsIdentity, getLearningRepository } from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { LmsIdentity, BatchList } from '@/components/lms/LmsViews';
export default async function LmsHome() {
  const user = await requireStudentIdentity();
  return (
    <LmsBoundary
      load={async () => {
        const [identity, courses] = await Promise.all([
          getLmsIdentity(),
          (await getLearningRepository()).courses(),
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
            <section className="lms-panel lms-upcoming">
              <h2>Learning activity</h2>
              <div>
                {[
                  ['Schedule', 'No sessions scheduled yet.'],
                  ['Tasks', 'No learning tasks available yet.'],
                  ['Announcements', 'No announcements available yet.'],
                  ['Support sessions', 'No support sessions scheduled yet.'],
                ].map(([title, text]) => (
                  <div key={title}>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        );
      }}
    />
  );
}
