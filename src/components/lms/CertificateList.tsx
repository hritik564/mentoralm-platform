import Link from 'next/link';
import type { Academics } from '@/lib/lms/academics';
import type { LearningCourse } from '@/lib/lms/learning';
import { lmsHref } from '@/lib/platform/domains';
import { LmsPageHeader, LmsIcon, LmsStatusBadge } from './LmsPrimitives';
export function CertificateList({
  certificates,
  courses,
}: {
  certificates: Awaited<ReturnType<Academics['certificates']>>;
  courses: LearningCourse[];
}) {
  return (
    <>
      <LmsPageHeader
        title="Certificates"
        description="Your earned course records and real completion progress."
      >
        <span className="lms-status">{certificates.length} earned</span>
      </LmsPageHeader>
      <div className="lms-certificate-grid">
        {certificates.map((c) => (
          <article className="lms-panel lms-certificate-card" key={c.code}>
            <div className="lms-certificate-emblem">
              <LmsIcon name="certificate" />
              <span>MentoraLM</span>
              <strong>Completion record</strong>
            </div>
            <div>
              <LmsStatusBadge status="ACTIVE" />
              <h2>{c.course}</h2>
              <p>
                Issued{' '}
                {new Date(c.issuedAt).toLocaleDateString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}
              </p>
              <Link
                className="lms-action"
                href={lmsHref(`/learn/certificates/${c.code}`)}
              >
                View certificate →
              </Link>
              {c.documentAvailable && (
                <a
                  className="lms-action lms-action--secondary"
                  href={`/api/lms/academic/certificates/${c.code}/media?download=1`}
                >
                  Download PDF
                </a>
              )}
              {!c.documentAvailable && (
                <p className="lms-rule-note">Record only · PDF not attached</p>
              )}
            </div>
          </article>
        ))}
        {courses
          .filter(
            (c) =>
              c.certificateEnabled &&
              !certificates.some((cert) => cert.courseId === c.id),
          )
          .map((c) => (
            <article
              className="lms-panel lms-certificate-card lms-certificate-progress"
              key={c.id}
            >
              <div className="lms-certificate-emblem">
                <LmsIcon name="learn" />
                <strong>Course requirements</strong>
              </div>
              <div>
                <LmsStatusBadge
                  status={
                    c.completion.certificateEligible
                      ? 'Eligible'
                      : 'In progress'
                  }
                />
                <h2>{c.title}</h2>
                <p>No issued certificate is available for this course.</p>
                <progress
                  aria-label={`Completion progress: ${c.title}`}
                  max="100"
                  value={c.progress.percentage || 0}
                />
                <p>
                  {c.progress.completedItems} of {c.progress.requiredItems}{' '}
                  required items complete
                  {c.progress.percentage !== null
                    ? ` · ${c.progress.percentage}%`
                    : ''}
                </p>
                <Link
                  className="lms-action lms-action--secondary"
                  href={lmsHref(`/learn/courses/${c.id}`)}
                >
                  View requirements →
                </Link>
              </div>
            </article>
          ))}
      </div>
      {!certificates.length && !courses.some((c) => c.certificateEnabled) && (
        <p className="lms-empty">
          No certificates available. Eligible courses issue a record after all
          configured completion requirements are satisfied.
        </p>
      )}
    </>
  );
}
