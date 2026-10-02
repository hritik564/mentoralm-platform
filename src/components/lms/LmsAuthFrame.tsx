'use client';
import Link from 'next/link';
import { lmsHref } from '@/lib/platform/domains';
import {
  DashboardThemeToggle,
  useDashboardTheme,
} from '../dashboard/theme/DashboardTheme';
export function LmsAuthFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useDashboardTheme();
  return (
    <div className="lms-shell lms-auth-shell" data-lms-theme={theme}>
      <header className="lms-auth-header">
        <Link className="lms-auth-wordmark" href={lmsHref('/learn')}>
          Mentora<span>.</span>
        </Link>
        <DashboardThemeToggle className="lms-theme-toggle" />
      </header>
      <main className="lms-auth-layout">
        <section className="lms-auth-story" aria-label="Mentora learning">
          <p className="lms-eyebrow">Your learning workspace</p>
          <h1>
            Your learning
            <br /> continues here.
          </h1>
          <p>Sign in with your Mentora account to continue learning.</p>
          <p className="lms-auth-account-note">
            One account for Mentora Dashboard and learning.
          </p>
        </section>
        <section className="lms-auth-panel" aria-label="Student account entry">
          {children}
        </section>
      </main>
      <footer className="lms-auth-footer">
        Mentora learning · Your next step, together.
      </footer>
    </div>
  );
}
