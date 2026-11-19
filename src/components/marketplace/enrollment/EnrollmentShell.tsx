import { Navbar } from '@/components/navigation/Navbar';
import { websiteHref } from '@/lib/platform/domains';
import type { ReactNode } from 'react';
import '@/styles/marketplace-enrollment.css';
export function EnrollmentShell({ children }: { children: ReactNode }) {
  return (
    <div className="enrollment-shell" id="top">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar homeHref={websiteHref('/')} />
      <main id="main-content" className="enrollment-main">
        {children}
      </main>
      <footer className="enrollment-footer">
        One MentoraLM account. A thoughtful next step.{' '}
        <a href="/dashboard/support">Get support</a>
      </footer>
    </div>
  );
}
