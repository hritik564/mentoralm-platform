import { StudentError, errorMessages } from '@/lib/student/errors';
import { notFound } from 'next/navigation';
import { LmsAccessUnavailable } from './LmsAccessUnavailable';
export async function LmsBoundary({
  load,
}: {
  load: () => Promise<React.ReactNode>;
}) {
  try {
    return await load();
  } catch (error) {
    if (error instanceof StudentError && error.code === 'FORBIDDEN')
      return <LmsAccessUnavailable />;
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
