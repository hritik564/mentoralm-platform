import { StudentError, errorMessages } from '@/lib/student/errors';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { websiteHref } from '@/lib/platform/domains';
export async function LmsBoundary({
  load,
}: {
  load: () => Promise<React.ReactNode>;
}) {
  try {
    return await load();
  } catch (error) {
    if (error instanceof StudentError && error.code === 'FORBIDDEN')
      return (
        <section className="lms-panel lms-empty">
          <h1>Learning access unavailable</h1>
          <p role="status">
            Your learning workspace is not available right now. Contact Support
            if you need help.
          </p>
          <Link className="lms-action" href={websiteHref('/dashboard/support')}>
            Contact Support
          </Link>
        </section>
      );
    if (error instanceof StudentError && error.code === 'NOT_FOUND') notFound();
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error('lms_data_unavailable');
    return (
      <section className="lms-panel">
        <h1>Learning workspace</h1>
        <p role="status">
          {error instanceof StudentError
            ? errorMessages[error.code]
            : errorMessages.UNAVAILABLE}
        </p>
      </section>
    );
  }
}
