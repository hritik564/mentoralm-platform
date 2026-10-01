import { StudentError, errorMessages } from '@/lib/student/errors';
export async function DashboardDataBoundary({
  load,
}: {
  load: () => Promise<React.ReactNode>;
}) {
  try {
    return await load();
  } catch (error) {
    // Framework redirect/not-found exceptions must retain their semantics.
    if (typeof error === 'object' && error && 'digest' in error) throw error;
    const message =
      error instanceof StudentError
        ? errorMessages[error.code]
        : errorMessages.UNAVAILABLE;
    console.error('dashboard_data_unavailable');
    return (
      <section className="d3-panel" aria-labelledby="data-unavailable-title">
        <h1 id="data-unavailable-title">Your workspace</h1>
        <p role="status" className="d3-muted">
          {message}
        </p>
        <p className="d3-muted">
          Your account and navigation remain available. Please try again later.
        </p>
      </section>
    );
  }
}
