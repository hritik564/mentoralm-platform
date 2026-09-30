import Link from 'next/link';
import { dashboardNavigation } from '@/content/dashboard';
import { DashboardIcon } from './DashboardIcon';

export function DashboardNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="dashboard-nav" aria-label="Student dashboard">
      {dashboardNavigation.map((item) => (
        <Link
          prefetch={false}
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
          onClick={onNavigate}
        >
          <DashboardIcon name={item.icon} />
          <span>{item.label}</span>
          {pathname === item.href && (
            <span className="dashboard-nav-indicator" aria-hidden="true" />
          )}
        </Link>
      ))}
    </nav>
  );
}
