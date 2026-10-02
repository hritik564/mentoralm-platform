'use client';
import Link from 'next/link';
import { useClerk } from '@clerk/nextjs';
import { useState } from 'react';
import { TicketComposer } from './LmsSupport';
import { studentRequest } from '@/lib/dashboard/student-client';
import { websiteHref, lmsHref } from '@/lib/platform/domains';
export function LmsAccessUnavailable({ retryUrl }: { retryUrl?: string }) {
  const { signOut } = useClerk();
  const [contact, setContact] = useState(false),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="lms-entry-state">
      <p className="lms-eyebrow">Mentora learning</p>
      <h1>
        {retryUrl
          ? 'Your workspace couldn’t open'
          : 'Learning access unavailable'}
      </h1>
      <p role="status">
        {retryUrl
          ? 'We couldn’t open your learning workspace right now. Please try again in a moment.'
          : 'Learning access isn’t enabled for this account yet.'}
      </p>
      <div className="lms-account-actions">
        {retryUrl ? (
          <a className="lms-action" href={retryUrl}>
            Try again
          </a>
        ) : (
          <button
            type="button"
            className="lms-action"
            onClick={() => setContact(true)}
          >
            Contact Support
          </button>
        )}
        <button
          type="button"
          className="lms-secondary-action"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signOut({ redirectUrl: lmsHref('/learn') });
            } catch {
              setNotice('Unable to log out. Please try again.');
              setBusy(false);
            }
          }}
        >
          {busy ? 'Logging out…' : 'Log out'}
        </button>
      </div>
      <Link className="lms-entry-dashboard" href={websiteHref('/dashboard')}>
        Go to Mentora Dashboard →
      </Link>
      <p role="status">{notice}</p>
      {contact && (
        <TicketComposer
          request={studentRequest}
          onClose={() => setContact(false)}
          onCreated={() => {
            setContact(false);
            setNotice('Your support ticket has been created.');
          }}
        />
      )}
    </section>
  );
}
