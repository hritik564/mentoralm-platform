'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AccountIdentity } from '../auth/UserAvatar';
import { UserAvatar } from '../auth/UserAvatar';
import { Brand } from '../layout/Brand';
import { lmsHref, websiteHref, lmsInternalPath } from '@/lib/platform/domains';
const primary = [
  ['Home', '/learn'],
  ['Learn', '/learn/lectures'],
  ['Chat', '/learn/chat'],
  ['Support', '/dashboard/support'],
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
  const rawPath = usePathname();
  const path = lmsInternalPath(rawPath) || rawPath;
  const learning = path !== '/learn' && path !== '/learn/chat';
  return (
    <div className="lms-shell" data-lms-theme="dark">
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
                  (href === '/learn/lectures' ? learning : path === href)
                    ? 'page'
                    : undefined
                }
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link
            className="lms-account"
            href={websiteHref('/dashboard/profile')}
            aria-label="Manage your account"
          >
            <UserAvatar user={user} />
            <span>{user.name || 'Your account'}</span>
          </Link>
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
                (href === '/learn/certificates' &&
                  path.startsWith('/learn/certificates/')) ||
                (href === '/learn/lectures' &&
                  path.startsWith('/learn/courses/') &&
                  !path.includes('/assignments/'))
                  ? 'page'
                  : undefined
              }
            >
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
