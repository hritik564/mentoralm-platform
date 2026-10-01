import { getAcademics } from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <LmsBoundary
      load={async () => {
        const c = await (await getAcademics()).certificate(code);
        return (
          <section className="lms-panel l3-certificate">
            <p className="lms-eyebrow">MentoraLM · Certificate record</p>
            <h1>{c.course}</h1>
            <p>
              Issued after the course completion requirements were satisfied.
            </p>
            <dl>
              <dt>Certificate code</dt>
              <dd>{c.code}</dd>
              <dt>Issued</dt>
              <dd>
                <time dateTime={c.issuedAt}>
                  {new Date(c.issuedAt).toLocaleDateString('en-US', {
                    timeZone: 'UTC',
                  })}
                </time>
              </dd>
            </dl>
            {c.documentAvailable ? (
              <a
                className="lms-action"
                href={`/api/lms/academic/certificates/${c.code}/media?download=1`}
              >
                Download certificate PDF
              </a>
            ) : (
              <p>A certificate document has not been attached yet.</p>
            )}
          </section>
        );
      }}
    />
  );
}
