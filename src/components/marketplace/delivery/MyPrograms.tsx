import Link from 'next/link';
import Image from 'next/image';
import type { MyPrograms as Programs } from '@/lib/marketplace/delivery/read';
import '@/styles/marketplace-delivery.css';
const labels = {
  ACTIVE: 'Ready to learn',
  OWNED: 'Program purchased',
  PREPARING: 'Preparing your access',
  ATTENTION: 'Access needs attention',
};
export function MyPrograms({
  programs,
  heading = false,
}: {
  programs: Programs;
  heading?: boolean;
}) {
  const Heading = heading ? 'h1' : 'h2';
  return (
    <section
      className="my-programs d2-panel"
      aria-labelledby="my-programs-heading"
    >
      <p className="dashboard-eyebrow">Your purchases</p>
      <Heading id="my-programs-heading">My Programs</Heading>
      <p>Your purchased programs and the next step for each journey.</p>
      {programs.items.length ? (
        <div className="my-programs-grid">
          {programs.items.map((p) => (
            <article className="my-program-card" key={p.orderPath}>
              <div className="my-program-image">
                <Image
                  src={p.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                />
              </div>
              <div className="my-program-body">
                <p className="my-program-status">
                  {labels[p.state as keyof typeof labels]}
                </p>
                <h3>{p.title}</h3>
                <p className="my-program-date">
                  Purchased{' '}
                  <time dateTime={p.grantedAt}>
                    {new Intl.DateTimeFormat('en', {
                      dateStyle: 'medium',
                      timeZone: 'UTC',
                    }).format(new Date(p.grantedAt))}
                  </time>
                </p>
                {['ATTENTION', 'PREPARING'].includes(p.state) && (
                  <p>
                    Your purchase is confirmed, but we&apos;re still preparing
                    access.
                  </p>
                )}
                {p.state === 'OWNED' && (
                  <p>
                    This program does not require LMS delivery. Your purchase
                    remains saved here.
                  </p>
                )}
                <div className="my-program-actions">
                  {p.learningPath ? (
                    <Link href={p.learningPath} className="my-program-primary">
                      Continue Learning
                    </Link>
                  ) : p.state === 'OWNED' && p.programPath ? (
                    <Link href={p.programPath}>View program</Link>
                  ) : (
                    <Link href="/dashboard/support">Contact Support</Link>
                  )}
                  <Link href={p.orderPath}>Purchase details</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p>
          No purchased programs yet.{' '}
          <Link href="/courses">Explore programs</Link>.
        </p>
      )}
      {(programs.page > 1 || programs.hasNext) && (
        <nav aria-label="My Programs pages">
          {programs.page > 1 && (
            <Link href={`/dashboard/programs?page=${programs.page - 1}`}>
              Previous
            </Link>
          )}
          {programs.hasNext && (
            <Link href={`/dashboard/programs?page=${programs.page + 1}`}>
              Next
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
