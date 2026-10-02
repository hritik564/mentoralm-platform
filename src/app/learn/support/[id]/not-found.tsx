import Link from 'next/link';
import { lmsHref } from '@/lib/platform/domains';
export default function NotFound() {
  return (
    <section className="lms-panel lms-empty">
      <h1>Ticket unavailable</h1>
      <p>
        This ticket is unavailable. Return to your requests or create a new
        ticket.
      </p>
      <Link className="lms-action" href={lmsHref('/learn/support')}>
        Your support tickets
      </Link>
    </section>
  );
}
