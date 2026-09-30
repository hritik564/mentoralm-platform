import Link from 'next/link';
import type { AccountIdentity } from '@/components/auth/UserAvatar';
import { Menti } from '@/components/menti/Menti';
import { DashboardIcon } from './DashboardIcon';

export function DashboardOverview({ user }: { user: AccountIdentity }) {
  return (
    <>
      <section className="dashboard-welcome" aria-labelledby="welcome-title">
        <div>
          <p className="dashboard-eyebrow">
            A little clarity. A little momentum.
          </p>
          <h1 id="welcome-title">
            Welcome back{user.firstName ? `, ${user.firstName}` : ''}.
          </h1>
          <p>Your next chapter starts with a clear space to move forward.</p>
        </div>
        <div className="dashboard-menti">
          <Menti />
          <p>
            Good to see you.
            <br />
            <span>Menti · Your future AI guide</span>
          </p>
        </div>
      </section>
      <div className="dashboard-development-note">
        <span aria-hidden="true" />
        <p>
          Your workspace is taking shape. These areas are in development; no
          learning activity or progress is shown yet.
        </p>
      </div>
      <section
        className="dashboard-overview-grid"
        aria-label="Your workspace areas"
      >
        <Link
          prefetch={false}
          href="/dashboard/courses"
          className="dashboard-area-card"
        >
          <DashboardIcon name="courses" />
          <span className="dashboard-state-label">In development</span>
          <h2>My Courses</h2>
          <p>A home for the courses you explore and enroll in.</p>
          <span className="dashboard-card-link">View course space →</span>
        </Link>
        <article className="dashboard-area-card">
          <DashboardIcon name="overview" />
          <span className="dashboard-state-label">In development</span>
          <h2>Continue Learning</h2>
          <p>
            Your learning will continue here when courses and the LMS are ready.
          </p>
          <span className="dashboard-card-footnote">
            Learning is not available yet.
          </span>
        </article>
        <Link
          prefetch={false}
          href="/dashboard/resources"
          className="dashboard-area-card"
        >
          <DashboardIcon name="resources" />
          <span className="dashboard-state-label">In development</span>
          <h2>Resources</h2>
          <p>Useful tools for learning, discovery and your next step.</p>
          <span className="dashboard-card-link">View resource space →</span>
        </Link>
        <Link
          prefetch={false}
          href="/dashboard/support"
          className="dashboard-area-card"
        >
          <DashboardIcon name="support" />
          <span className="dashboard-state-label">In development</span>
          <h2>Support</h2>
          <p>A clear place to find help as your journey grows.</p>
          <span className="dashboard-card-link">View support space →</span>
        </Link>
      </section>
    </>
  );
}
