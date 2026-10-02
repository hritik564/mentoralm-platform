import type { ReactNode } from 'react';
export function LmsIcon({ name = 'learn' }: { name?: string }) {
  const paths: Record<string, string> = {
    home: 'M3 10 12 3l9 7v10h-6v-7H9v7H3Z',
    learn:
      'M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-4-2-7-1-10 1Z',
    chat: 'M21 11a9 9 0 0 1-9 9H4l-2 2v-11a9 9 0 1 1 19 0Z',
    support: 'M3 14v-3a9 9 0 0 1 18 0v7l-4 3h-5M3 12h4v7H3ZM17 12h4v7h-4Z',
    lesson: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM10 7l7 5-7 5Z',
    assignment: 'M5 3h14v18H5ZM9 7h6M9 11h6M9 15h4',
    resource: 'M3 6h7l2 3h9v12H3ZM3 6V3h7l2 3h9v3',
    attendance: 'M3 5h18v16H3ZM7 2v6M17 2v6M3 10h18M7 14h3M14 14h3M7 18h3',
    certificate:
      'M12 2l3 3 4 1v5l-3 4-4 2-4-2-3-4V6l4-1ZM8 16l-1 6 5-3 5 3-1-6',
    quiz: 'M9 8a3 3 0 1 1 5 2l-2 2v2M12 18h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
    search: 'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.learn} />
    </svg>
  );
}
export function LmsStatusBadge({ status }: { status: string }) {
  const label =
    status === 'NOT_SUBMITTED'
      ? 'Pending'
      : status.replaceAll('_', ' ').toLowerCase();
  const key = status.toUpperCase().replaceAll(' ', '_');
  const tones: Record<string, string> = {
    COMPLETED: 'success',
    SUBMITTED: 'success',
    ACCEPTED: 'success',
    PRESENT: 'success',
    ACTIVE: 'success',
    PASSED: 'success',
    ABSENT: 'danger',
    REVOKED: 'danger',
    CHANGES_REQUESTED: 'danger',
    NOT_PASSED: 'danger',
    PENDING: 'warning',
    NOT_SUBMITTED: 'warning',
    LATE: 'warning',
    UNDER_REVIEW: 'warning',
    SUSPENDED: 'warning',
    UPCOMING: 'warning',
    IN_PROGRESS: 'warning',
  };
  const tone = tones[key] || 'neutral';
  return <span className={`lms-status lms-status--${tone}`}>{label}</span>;
}
export function LmsPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="lms-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function LmsSectionCard({
  title,
  icon,
  action,
  children,
  className = '',
}: {
  title: string;
  icon?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`lms-panel ${className}`}>
      <header className="lms-card-header">
        <h2>
          <LmsIcon name={icon} />
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
export function LmsEmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="lms-empty">
      <LmsIcon />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
