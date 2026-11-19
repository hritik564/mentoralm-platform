'use client';
import Link from 'next/link';
import { EnrollmentShell } from './EnrollmentShell';
export function EnrollmentError({ retry }: { retry: () => void }) {
  return (
    <EnrollmentShell>
      <section className="enrollment-card" role="status">
        <p className="enrollment-eyebrow">Your enrollment</p>
        <h1>Enrollment is temporarily unavailable</h1>
        <p>Your saved progress is preserved. Please try again in a moment.</p>
        <button type="button" className="enrollment-primary" onClick={retry}>
          Try again
        </button>
        <p>
          <Link href="/courses">Explore programs</Link> ·{' '}
          <Link href="/dashboard/support">Contact support</Link>
        </p>
      </section>
    </EnrollmentShell>
  );
}
