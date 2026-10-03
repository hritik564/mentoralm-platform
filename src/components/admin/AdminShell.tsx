'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, createContext, useContext } from 'react';
import { useClerk } from '@clerk/nextjs';
import {
  DashboardThemeToggle,
  useDashboardTheme,
} from '../dashboard/theme/DashboardTheme';
import { AccountMenu } from '../auth/AccountMenu';
import type { AccountIdentity } from '../auth/UserAvatar';
import { adminHref } from '@/lib/platform/domains';
import { adminPathPermission } from '@/lib/admin/permissions';
import type {
  AdminPermission,
  AdminAuthority,
} from '@/generated/prisma/client';
const AccessContext = createContext<{
  authority: AdminAuthority | null;
  permissions: AdminPermission[];
}>({ authority: null, permissions: [] });
export const useAdminAccess = () => useContext(AccessContext);
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
  ['Instructors', '/admin/instructors'],
  ['Referrals', '/admin/referrals'],
  ['Users & Access', '/admin/users'],
  ['Audit Logs', '/admin/audit'],
  ['Settings', '/admin/settings'],
] as const;
export function AdminShell({
  children,
  user,
  access,
}: {
  children: React.ReactNode;
  user: AccountIdentity;
  access: { authority: AdminAuthority | null; permissions: AdminPermission[] };
}) {
  const { theme } = useDashboardTheme(),
    { signOut } = useClerk(),
    path = usePathname(),
    [open, setOpen] = useState(false),
    navigationTrigger = useRef<HTMLButtonElement>(null);
  return (
    <AccessContext.Provider value={access}>
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
            {nav
              .filter(
                ([, href]) =>
                  !adminPathPermission(href) ||
                  access.permissions.includes(adminPathPermission(href)!),
              )
              .map(([label, href], i) =>
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
                    <span aria-hidden="true">
                      {['◈', '♧', '▤', '▦'][i % 4]}
                    </span>
                    {label}
                  </Link>
                ) : null,
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
            <span className="admin-search-placeholder">Admin Console</span>
            <div className="admin-topbar-controls">
              <DashboardThemeToggle className="admin-icon-button" />
              <span className="admin-role">
                {access.authority === 'GOVERNANCE' ? 'Governance' : 'Admin'}
              </span>
              <AccountMenu
                className="admin-account"
                user={user}
                links={[]}
                onSignOut={() => signOut({ redirectUrl: adminHref('/admin') })}
              />
            </div>
          </header>
          <main id="admin-content" className="admin-content">
            {!access.permissions.length ? (
              <section className="admin-card">
                <h1>No permissions assigned</h1>
                <p>
                  Your account can enter the Admin Console. A Governance
                  administrator must assign permissions before you can use its
                  operational areas.
                </p>
              </section>
            ) : adminPathPermission(
                path.startsWith('/admin') ? path : `/admin${path}`,
              ) &&
              !access.permissions.includes(
                adminPathPermission(
                  path.startsWith('/admin') ? path : `/admin${path}`,
                )!,
              ) ? (
              <section className="admin-card">
                <h1>Access unavailable</h1>
                <p>Your current Admin permissions do not include this area.</p>
                <Link href={adminHref('/admin')}>Return to Overview</Link>
              </section>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </AccessContext.Provider>
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
