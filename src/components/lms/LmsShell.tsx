'use client';
import Link from 'next/link';
import {
  useDashboardTheme,
  DashboardThemeToggle,
} from '../dashboard/theme/DashboardTheme';
import { usePathname } from 'next/navigation';
import type { AccountIdentity } from '../auth/UserAvatar';
import { LmsIcon } from './LmsPrimitives';
import { AccountMenu } from '../auth/AccountMenu';
import { useClerk } from '@clerk/nextjs';
import { Brand } from '../layout/Brand';
import { lmsHref, websiteHref, lmsInternalPath } from '@/lib/platform/domains';
const primary = [
  ['Home', '/learn'],
  ['Learn', '/learn/lectures'],
  ['Chat', '/learn/chat'],
  ['Support', '/learn/support'],
] as const;
const secondary = [
  ['Lectures', '/learn/lectures'],
  ['Assignments', '/learn/assignments'],
  ['Resources', '/learn/resources'],
  ['Attendance', '/learn/attendance'],
  ['Certificates', '/learn/certificates'],
  ['Discussions', '/learn/discussions'],
] as const;
export function LmsShell({
  user,
  children,
}: {
  user: AccountIdentity;
  children: React.ReactNode;
}) {
  const { signOut } = useClerk();
  const { theme } = useDashboardTheme();
  const rawPath = usePathname();
  const path = lmsInternalPath(rawPath) || rawPath;
  const learning =
    !['/learn', '/learn/chat', '/learn/profile'].includes(path) &&
    !path.startsWith('/learn/support');
  return (
    <div className="lms-shell" data-lms-theme={theme}>
      <a className="lms-skip" href="#lms-content">
        Skip to learning content
      </a>
      <header className="lms-header">
        <div className="lms-appbar">
          <Brand href={lmsHref('/learn')} />
          <nav aria-label="LMS primary navigation">
            {primary.map(([label, href]) => (
              <Link
                key={href}
                href={
                  href.startsWith('/learn') ? lmsHref(href) : websiteHref(href)
                }
                prefetch={false}
                aria-current={
                  (
                    href === '/learn/lectures'
                      ? learning
                      : href === '/learn/support'
                        ? path.startsWith(href)
                        : path === href
                  )
                    ? 'page'
                    : undefined
                }
              >
                <LmsIcon name={label.toLowerCase()} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="lms-header-controls">
            <DashboardThemeToggle className="lms-theme-toggle" />
            <AccountMenu
              user={user}
              className="lms-account-menu"
              links={[
                { label: 'Profile', href: lmsHref('/learn/profile') },
                { label: 'Support', href: lmsHref('/learn/support') },
              ]}
              onSignOut={async () => {
                await signOut({ redirectUrl: lmsHref('/learn') });
              }}
            />
          </div>
        </div>
      </header>
      {learning && (
        <nav className="lms-subnav" aria-label="Learn navigation">
          {secondary.map(([label, href]) => (
            <Link
              key={href}
              href={
                href.startsWith('/learn') ? lmsHref(href) : websiteHref(href)
              }
              prefetch={false}
              aria-current={
                path === href ||
                (href === '/learn/assignments' &&
                  path.includes('/assignments/')) ||
                (href === '/learn/discussions' &&
                  path.startsWith('/learn/discussions/')) ||
                (href === '/learn/certificates' &&
                  path.startsWith('/learn/certificates/')) ||
                (href === '/learn/lectures' &&
                  path.startsWith('/learn/courses/') &&
                  !path.includes('/assignments/'))
                  ? 'page'
                  : undefined
              }
            >
              <LmsIcon
                name={
                  label === 'Lectures'
                    ? 'lesson'
                    : label === 'Assignments'
                      ? 'assignment'
                      : label === 'Resources'
                        ? 'resource'
                        : label === 'Discussions'
                          ? 'chat'
                          : label === 'Certificates'
                            ? 'certificate'
                            : 'attendance'
                }
              />
              {label}
            </Link>
          ))}
        </nav>
      )}
      <main id="lms-content" className="lms-content">
        {children}
      </main>
      <footer className="lms-footer">
        <span>MentoraLM Learning</span>
        <Link href={websiteHref('/dashboard')}>Student Dashboard ↗</Link>
      </footer>
    </div>
  );
}
