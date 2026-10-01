import Link from 'next/link';
import { getAcademics } from '@/lib/lms/services';
import { learningItemHref, lmsHref } from '@/lib/platform/domains';
export async function AcademicHome() {
  const repo = await getAcademics(),
    [assignments, attendance, certificates, result] = await Promise.all([
      repo.assignments.list(),
      repo.attendance(),
      repo.certificates(),
      repo.recentResult(),
    ]);
  const pending = assignments.filter((a) =>
    ['NOT_SUBMITTED', 'CHANGES_REQUESTED'].includes(a.status),
  );
  if (
    !assignments.length &&
    !attendance.total &&
    !certificates.length &&
    !result
  )
    return null;
  return (
    <section className="lms-panel l3-home">
      <h2>Academic activity</h2>
      <div className="l3-home-grid">
        {result && (
          <div>
            <h3>Recent result</h3>
            <p>
              <Link href={learningItemHref(result.courseId, result.item)}>
                {result.item.title}
              </Link>
            </p>
            <p>
              {result.requiresReview
                ? 'Includes responses awaiting review'
                : result.percentage === null
                  ? 'Submitted'
                  : `${Math.round(result.percentage * 10) / 10}%`}
              {result.passed === true
                ? ' · Passed'
                : result.passed === false
                  ? ' · Not passed'
                  : ''}{' '}
              · Attempt {result.number}
            </p>
          </div>
        )}
        {assignments.length > 0 && (
          <div>
            <h3>Pending assignments · {pending.length}</h3>
            {pending.slice(0, 3).map((a) => (
              <p key={a.id}>
                <Link
                  href={learningItemHref(a.courseId, {
                    id: a.id,
                    type: 'ASSIGNMENT',
                  })}
                >
                  {a.title}
                </Link>
              </p>
            ))}
            {!pending.length && <p>No pending assignments.</p>}
          </div>
        )}
        {attendance.total > 0 && (
          <div>
            <h3>Attendance</h3>
            <p>
              {attendance.percentage === null
                ? 'No percentage available'
                : `${attendance.percentage}%`}{' '}
              · {attendance.total} sessions
            </p>
            <Link href={lmsHref('/learn/attendance')}>View attendance →</Link>
          </div>
        )}
        {certificates.length > 0 && (
          <div>
            <h3>Certificates · {certificates.length}</h3>
            <Link href={lmsHref('/learn/certificates')}>
              View certificates →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
