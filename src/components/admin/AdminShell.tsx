'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef } from 'react';
import { useClerk } from '@clerk/nextjs';
import {
  DashboardThemeToggle,
  useDashboardTheme,
} from '../dashboard/theme/DashboardTheme';
import { AccountMenu } from '../auth/AccountMenu';
import type { AccountIdentity } from '../auth/UserAvatar';
import { adminHref } from '@/lib/platform/domains';
const nav = [
  ['Overview', '/admin'],
  ['Students', '/admin/students'],
  ['Programs & Courses', '/admin/courses'],
  ['Batches', '/admin/batches'],
  ['Attendance', '/admin/attendance'],
  ['Assessments', '/admin/assessments'],
  ['Assignments', '/admin/assignments'],
  ['Certificates', '/admin/certificates'],
  ['Discussions', '/admin/discussions'],
  ['Support', '/admin/support'],
  ['Communications', '/admin/communications'],
  ['Instructors', null],
  ['Referrals', '/admin/referrals'],
  ['Users & Access', null],
  ['Audit Logs', null],
  ['Settings', null],
] as const;
export function AdminShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AccountIdentity;
}) {
  const { theme } = useDashboardTheme(),
    { signOut } = useClerk(),
    path = usePathname(),
    [open, setOpen] = useState(false),
    navigationTrigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="admin-shell" data-admin-theme={theme}>
      <a className="admin-skip" href="#admin-content">
        Skip to Admin content
      </a>
      <aside
        id="admin-sidebar"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            navigationTrigger.current?.focus();
          }
        }}
        className={`admin-sidebar ${open ? 'is-open' : ''}`}
      >
        <Link className="admin-wordmark" href={adminHref('/admin')}>
          Mentora<span>.</span>
        </Link>
        <nav aria-label="Admin navigation">
          {nav.map(([label, href], i) =>
            href ? (
              <Link
                key={label}
                href={adminHref(href)}
                aria-current={
                  (
                    href === '/admin'
                      ? path === '/admin' || path === '/'
                      : path.includes(href.slice(6)) ||
                        (href === '/admin/assessments' &&
                          (path.includes('/question-banks/') ||
                            path.includes('/attempts'))) ||
                        (href === '/admin/assignments' &&
                          path.includes('/submissions'))
                  )
                    ? 'page'
                    : undefined
                }
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true">{['◈', '♧', '▤', '▦'][i % 4]}</span>
                {label}
              </Link>
            ) : (
              <span
                key={label}
                className="admin-nav-disabled"
                aria-disabled="true"
                title="Unavailable in A1"
              >
                <span aria-hidden="true">◇</span>
                {label}
              </span>
            ),
          )}
        </nav>
        <p className="admin-sidebar-caption">Admin workspace</p>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button
            ref={navigationTrigger}
            className="admin-icon-button admin-mobile-nav"
            aria-expanded={open}
            aria-controls="admin-sidebar"
            onClick={() => setOpen(!open)}
            aria-label={
              open ? 'Close Admin navigation' : 'Open Admin navigation'
            }
          >
            ☰
          </button>
          <span className="admin-search-placeholder">
            ⌕ Global search unavailable in A1
          </span>
          <div className="admin-topbar-controls">
            <DashboardThemeToggle className="admin-icon-button" />
            <span className="admin-role">Admin</span>
            <AccountMenu
              className="admin-account"
              user={user}
              links={[]}
              onSignOut={() => signOut({ redirectUrl: adminHref('/admin') })}
            />
          </div>
        </header>
        <main id="admin-content" className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
export function AdminEntryFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useDashboardTheme();
  return (
    <main className="admin-shell admin-entry" data-admin-theme={theme}>
      <header>
        <span className="admin-wordmark">
          Mentora<span>.</span>
        </span>
        <DashboardThemeToggle className="admin-icon-button" />
      </header>
      <section className="admin-entry-card">{children}</section>
    </main>
  );
}
export function AdminUnavailable({ retry = false }: { retry?: boolean }) {
  const { signOut } = useClerk();
  const [error, setError] = useState('');
  return (
    <>
      <h1>{retry ? 'Admin workspace unavailable' : 'Access denied'}</h1>
      <p>
        {retry
          ? 'Please try again in a moment.'
          : 'This account does not have access to the Admin Console.'}
      </p>
      {retry && (
        <button className="admin-button" onClick={() => location.reload()}>
          Try again
        </button>
      )}
      <button
        className="admin-button secondary"
        onClick={() =>
          signOut({ redirectUrl: adminHref('/admin') }).catch(() =>
            setError('Unable to log out. Please try again.'),
          )
        }
      >
        Log out
      </button>
      <p role="status">{error}</p>
    </>
  );
}
