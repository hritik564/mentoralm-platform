import type { Academics } from '@/lib/lms/academics';
export function AttendanceView({
  attendance: a,
}: {
  attendance: Awaited<ReturnType<Academics['attendance']>>;
}) {
  return (
    <section className="lms-panel l3-surface">
      <h1>Attendance</h1>
      <p>
        Held sessions during your membership. Present and late count as
        attended; excused sessions are excluded from the percentage. Unrecorded
        sessions remain in the denominator.
      </p>
      {a.total ? (
        <>
          <dl className="l3-metrics">
            {[
              ['Sessions', a.total],
              ['Present', a.present],
              ['Late', a.late],
              ['Absent', a.absent],
              ['Excused', a.excused],
              ['Unrecorded', a.unrecorded],
              [
                'Attendance',
                a.percentage === null ? 'Not available' : `${a.percentage}%`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <ul className="lms-list">
            {a.sessions.map((s) => (
              <li key={s.id}>
                <div>
                  <span className="lms-eyebrow">{s.batch}</span>
                  <h2>{s.title}</h2>
                  <time dateTime={s.startsAt}>
                    {new Date(s.startsAt).toLocaleString('en-US', {
                      timeZone: 'UTC',
                    })}{' '}
                    UTC
                  </time>
                </div>
                <span>{s.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="lms-empty">
          No attendance records or applicable held sessions yet.
        </p>
      )}
    </section>
  );
}
