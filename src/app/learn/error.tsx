'use client';
export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <section className="lms-panel">
      <h1>Learning workspace unavailable</h1>
      <p>Please try again. Your saved learning state is kept.</p>
      <button className="lms-action" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
