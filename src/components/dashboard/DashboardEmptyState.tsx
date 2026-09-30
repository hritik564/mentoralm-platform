import Link from 'next/link';
import { dashboardEmptyStates } from '@/content/dashboard';
import { DashboardIcon } from './DashboardIcon';

export function DashboardEmptyState({
  area,
}: {
  area: keyof typeof dashboardEmptyStates;
}) {
  const state = dashboardEmptyStates[area];
  return (
    <section className="dashboard-empty-page">
      <p className="dashboard-eyebrow">Your workspace</p>
      <h1>{state.title}</h1>
      {area === 'courses' && (
        <div
          className="dashboard-course-boundaries"
          aria-label="Future course views"
        >
          <span>
            Viewed Courses <small>Coming later</small>
          </span>
          <span>
            Enrolled Courses <small>Coming later</small>
          </span>
        </div>
      )}
      <div className="dashboard-empty-state">
        <span className="dashboard-empty-icon">
          <DashboardIcon name={state.icon} />
        </span>
        <span className="dashboard-state-label">In development</span>
        <h2>{state.heading}</h2>
        <p>{state.description}</p>
        <p className="dashboard-empty-detail">{state.detail}</p>
        <Link
          prefetch={false}
          className="dashboard-back-link"
          href="/dashboard"
        >
          Back to Overview →
        </Link>
      </div>
    </section>
  );
}
