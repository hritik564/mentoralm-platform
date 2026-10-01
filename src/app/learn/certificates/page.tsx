import Link from 'next/link';
import { getAcademics, getLmsRepository } from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { lmsHref } from '@/lib/platform/domains';
export default function Page() {
  return (
    <LmsBoundary
      load={async () => {
        await getLmsRepository();
        const certificates = await (await getAcademics()).certificates();
        return (
          <section className="lms-panel l3-surface">
            <h1>Certificates</h1>
            {certificates.length ? (
              <ul className="lms-list">
                {certificates.map((c) => (
                  <li key={c.code}>
                    <div>
                      <h2>{c.course}</h2>
                      <p>
                        Issued{' '}
                        {new Date(c.issuedAt).toLocaleDateString('en-US', {
                          timeZone: 'UTC',
                        })}
                      </p>
                    </div>
                    <Link
                      className="lms-action"
                      href={lmsHref(`/learn/certificates/${c.code}`)}
                    >
                      View certificate
                      <span className="sr-only">: {c.course}</span> →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lms-empty">
                No certificates available. Eligible courses issue a record after
                all configured completion requirements are satisfied.
              </p>
            )}
          </section>
        );
      }}
    />
  );
}
