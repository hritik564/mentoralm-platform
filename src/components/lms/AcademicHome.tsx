import Link from 'next/link';
import type { ReactNode } from 'react';
import { getAcademics } from '@/lib/lms/services';
import { learningItemHref, lmsHref } from '@/lib/platform/domains';
import { LmsSectionCard, LmsStatusBadge } from './LmsPrimitives';
export async function AcademicHome({
  continueLearning,
  batches,
  discussions,
  support,
}: {
  continueLearning: ReactNode;
  batches: ReactNode;
  discussions: ReactNode;
  support: ReactNode;
}) {
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
  return (
    <div className="lms-home-grid">
      <div className="lms-home-column">
        {continueLearning}
        <LmsSectionCard
          title="Pending assignments"
          icon="assignment"
          className="lms-home-pending"
          action={<Link href={lmsHref('/learn/assignments')}>View all →</Link>}
        >
          <ul className="lms-home-rows">
            {pending.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link
                  href={learningItemHref(a.courseId, {
                    id: a.id,
                    type: 'ASSIGNMENT',
                  })}
                >
                  <strong>{a.title}</strong>
                  <small>{a.course}</small>
                </Link>
                <LmsStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
          {!pending.length && (
            <p className="lms-card-empty">
              No pending assignments. Your submitted work is in Assignments.
            </p>
          )}
        </LmsSectionCard>
      </div>
      <div className="lms-home-column">
        <LmsSectionCard
          title="Attendance"
          icon="attendance"
          action={<Link href={lmsHref('/learn/attendance')}>View all →</Link>}
        >
          <div className="lms-home-attendance">
            <div
              className="lms-ring"
              style={{
                background: `conic-gradient(#4addb0 ${(attendance.percentage || 0) * 3.6}deg, #263650 0deg)`,
              }}
            >
              <strong>
                {attendance.percentage === null
                  ? '—'
                  : `${attendance.percentage}%`}
              </strong>
            </div>
            <div>
              <strong>
                {attendance.present + attendance.late} of {attendance.total}{' '}
                sessions attended
              </strong>
              <p>
                {attendance.absent} absent · {attendance.excused} excused
              </p>
            </div>
          </div>
        </LmsSectionCard>
        {attendance.sessions.length > 0 && (
          <LmsSectionCard
            title="Recent sessions"
            icon="attendance"
            action={<Link href={lmsHref('/learn/attendance')}>View all →</Link>}
          >
            <ul className="lms-home-rows">
              {attendance.sessions.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{s.title}</strong>
                    <small>
                      {new Date(s.startsAt).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}{' '}
                      · {s.batch}
                    </small>
                  </div>
                  <LmsStatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          </LmsSectionCard>
        )}
        {result && (
          <LmsSectionCard title="Recent result" icon="quiz">
            <Link href={learningItemHref(result.courseId, result.item)}>
              {result.item.title}
            </Link>
            <p>
              {result.requiresReview
                ? 'Responses awaiting review'
                : result.percentage === null
                  ? 'Submitted'
                  : `${result.percentage}%`}{' '}
              · Attempt {result.number}
            </p>
          </LmsSectionCard>
        )}
      </div>
      <div className="lms-home-column">
        {discussions}
        {batches}
        {support}
        {certificates.length > 0 && (
          <LmsSectionCard title="Certificates" icon="certificate">
            <p>
              {certificates.length} earned certificate
              {certificates.length === 1 ? '' : 's'}
            </p>
            <Link href={lmsHref('/learn/certificates')}>
              View certificates →
            </Link>
          </LmsSectionCard>
        )}
      </div>
    </div>
  );
}
