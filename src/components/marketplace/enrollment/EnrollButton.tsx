'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
export function EnrollButton({
  slug,
  label = 'Enroll Now',
}: {
  slug: string;
  label?: string;
}) {
  const [owned, setOwned] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch(
      `/api/marketplace/commerce/ownership/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    )
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active) setOwned(data?.owned === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug]);
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  async function start() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/marketplace/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || 'Enrollment is temporarily unavailable.');
      if (
        typeof data.destination !== 'string' ||
        !/^\/(?:enroll\/[A-Za-z0-9_-]{43}|sign-in\?redirect_url=%2Fenroll%2F[A-Za-z0-9_-]{43})$/.test(
          data.destination,
        )
      )
        throw Error('Please reload and try again.');
      window.location.assign(data.destination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
      setPending(false);
    }
  }
  if (owned)
    return (
      <Link
        className="program-action-label enrollment-primary"
        href="/dashboard/programs"
      >
        Go to Dashboard
      </Link>
    );
  return (
    <div>
      <button
        type="button"
        className="program-action-label enrollment-primary"
        disabled={pending}
        onClick={start}
      >
        {pending ? 'Preparing enrollment…' : label}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
