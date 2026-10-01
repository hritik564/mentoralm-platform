import Link from 'next/link';
import { lmsHref, websiteHref } from '@/lib/platform/domains';
export default function MissingDiscussion() {
  return (
    <section className="lms-panel lms-empty">
      <h1>Discussion not available</h1>
      <p>This discussion is not available for your account.</p>
      <Link href={lmsHref('/learn/discussions')}>Return to discussions</Link>
      <p>
        <Link href={websiteHref('/dashboard/support')}>Contact Support</Link>
      </p>
    </section>
  );
}
