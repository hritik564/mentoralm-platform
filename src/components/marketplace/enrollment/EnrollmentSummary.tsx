import { programPrice } from '../program/presentation';
import Link from 'next/link';
import type { EnrollmentView } from '@/lib/marketplace/enrollment/types';
import { EnrollButton } from './EnrollButton';
export type Identity = { name: string; phone: string; email: string };
export function Quote({ view }: { view: EnrollmentView }) {
  const q = view.quote;
  return (
    <aside
      className="enrollment-card enrollment-quote"
      aria-label="Selected program"
    >
      <p className="enrollment-eyebrow">Your next chapter</p>
      <h2>{q.title}</h2>
      <p className="enrollment-price">{programPrice(q)}</p>
      <dl>
        <dt>Duration</dt>
        <dd>{q.durationLabel}</dd>
        <dt>Mode</dt>
        <dd>{q.deliveryMode.toLowerCase()}</dd>
        {q.cohortStartsAt && (
          <>
            <dt>Starts</dt>
            <dd>
              {new Date(q.cohortStartsAt).toLocaleDateString('en-IN', {
                timeZone: 'UTC',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </dd>
          </>
        )}
      </dl>
      <p>
        Your saved program price is held until{' '}
        <time dateTime={view.expiresAt}>
          {new Date(view.expiresAt).toLocaleString('en-IN', {
            timeZone: 'UTC',
            timeZoneName: 'short',
          })}
        </time>
        . Availability is checked again as you continue.
      </p>
      <a href={`/courses/${q.slug}`}>View program</a>
    </aside>
  );
}
export function Unavailable({ view }: { view: EnrollmentView }) {
  return (
    <section className="enrollment-card" role="status">
      <p className="enrollment-eyebrow">Your enrollment</p>
      <h1>
        {view.access === 'expired'
          ? 'This enrollment has expired'
          : view.access === 'cancelled'
            ? 'Enrollment cancelled'
            : 'This program is currently unavailable'}
      </h1>
      <p>
        {view.access === 'expired'
          ? 'Start again to see the current program price and availability. Your previous submission has been preserved.'
          : 'This enrollment cannot continue here. If you already started a payment, check its status in your Dashboard before trying again.'}
      </p>
      {view.access !== 'unavailable' && (
        <EnrollButton slug={view.quote.slug} label="Start a new enrollment" />
      )}
      <p>
        <Link href="/courses">Explore programs</Link> ·{' '}
        <a href="/dashboard/support">Contact support</a>
      </p>
    </section>
  );
}
export function Details({ view }: { view: EnrollmentView }) {
  return (
    <dl className="enrollment-details">
      {Object.entries(view.values)
        .filter(([, value]) => value)
        .map(([key, value]) => (
          <div key={key}>
            <dt>
              {
                (
                  {
                    fullName: 'Full name',
                    phone: 'Phone',
                    city: 'City',
                    region: 'State / region',
                    country: 'Country',
                    educationLevel: 'Education',
                    currentStatus: 'Current status',
                    institution: 'Institution / organization',
                    goal: 'Your goal',
                    source: 'How you found us',
                  } as Record<string, string>
                )[key]
              }
            </dt>
            <dd>
              {key === 'educationLevel' || key === 'currentStatus'
                ? value
                    ?.toLowerCase()
                    .replaceAll('_', ' ')
                    .replace(/^./, (char) => char.toUpperCase())
                : value}
            </dd>
          </div>
        ))}
    </dl>
  );
}
