'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { EnrollmentView } from '@/lib/marketplace/enrollment/types';
import {
  Details,
  Quote,
  Unavailable,
  type Identity,
} from './EnrollmentSummary';
export function CheckoutSummary({
  view,
  identity,
}: {
  view: EnrollmentView;
  identity: Identity;
}) {
  const router = useRouter();
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  async function cancel() {
    setPending(true);
    try {
      const response = await fetch(
        `/api/marketplace/enrollment/${view.ref}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: view.revision }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw Error(data.error);
      }
      router.push(`/enroll/${view.ref}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please reload and try again.');
      setPending(false);
    }
  }
  if (view.access !== 'active') return <Unavailable view={view} />;
  return (
    <>
      <header className="enrollment-heading">
        <p className="enrollment-eyebrow">Your next chapter, in focus</p>
        <h1>Review your enrollment</h1>
        <p>Your details are saved. Payment integration is coming next.</p>
      </header>
      <div className="enrollment-layout">
        <section className="enrollment-card">
          <p className="enrollment-eyebrow">Ready for checkout</p>
          <h2>{identity.name || view.values.fullName}</h2>
          <p>{identity.email}</p>
          <h3>Enrollment details confirmed</h3>
          <Details view={view} />
          <a href={`/enroll/${view.ref}`}>Edit enrollment details</a>
          <hr />
          <button type="button" className="enrollment-primary" disabled>
            Continue to Payment
          </button>
          <p>
            Payment integration coming next. No payment has been taken and no
            course access has been granted.
          </p>
          <button
            type="button"
            className="enrollment-secondary"
            disabled={pending}
            onClick={cancel}
          >
            {pending ? 'Cancelling…' : 'Cancel enrollment'}
          </button>
          {error && <p role="alert">{error}</p>}
        </section>
        <Quote view={view} />
      </div>
    </>
  );
}
