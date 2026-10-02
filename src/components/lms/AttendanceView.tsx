'use client';
import { useState } from 'react';
import type { Academics } from '@/lib/lms/academics';
import { LmsPageHeader, LmsStatusBadge, LmsIcon } from './LmsPrimitives';
import { LmsSearch, LmsFilter, filterOptions } from './LmsFilters';
export function AttendanceView({
  attendance: a,
}: {
  attendance: Awaited<ReturnType<Academics['attendance']>>;
}) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('');
  const sessions = a.sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) &&
      (!status || s.status === status),
  );
  return (
    <>
      <LmsPageHeader
        title="Attendance"
        description="Your class participation and session history."
      />
      <div className="lms-attendance-metrics">
        <section className="lms-panel lms-attendance-overview">
          <div
            className="lms-ring"
            style={{
              background: `conic-gradient(#4addb0 ${(a.percentage || 0) * 3.6}deg, #263650 0deg)`,
            }}
          >
            <strong>{a.percentage === null ? '—' : `${a.percentage}%`}</strong>
          </div>
          <div>
            <h2>Attendance</h2>
            <p>Present and late count as attended.</p>
          </div>
        </section>
        {[
          ['Sessions attended', a.present + a.late],
          ['Sessions missed', a.absent],
          ['Held sessions', a.total],
        ].map(([label, value]) => (
          <section className="lms-panel lms-metric" key={label}>
            <LmsIcon name="attendance" />
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </section>
        ))}
      </div>
      <section className="lms-panel lms-distribution">
        <h2>Status distribution</h2>
        <div className="lms-distribution-bars">
          {[
            ['Present', a.present],
            ['Late', a.late],
            ['Absent', a.absent],
            ['Excused', a.excused],
            ['Unrecorded', a.unrecorded],
          ].map(([label, value]) => (
            <div key={label}>
              <LmsStatusBadge status={String(label)} />
              <meter
                aria-label={String(label)}
                value={Number(value)}
                max={Math.max(a.total, 1)}
              />
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p className="lms-rule-note">
          Excused sessions are excluded from the percentage. Unrecorded held
          sessions remain in its denominator.
        </p>
      </section>
      <section className="lms-attendance-list">
        <div className="lms-toolbar">
          <h2>Session attendance</h2>
          <LmsSearch
            label="Search sessions"
            value={search}
            onChange={setSearch}
          />
          <LmsFilter
            label="Attendance status"
            value={status}
            onChange={setStatus}
            options={filterOptions(
              a.sessions.map((s) => s.status),
              'All statuses',
            )}
          />
        </div>
        <ul className="lms-dense-list">
          {sessions.map((s) => (
            <li className="lms-learning-row" key={s.id}>
              <span className="lms-row-icon">
                <LmsIcon name="attendance" />
              </span>
              <div className="lms-row-main">
                <h3>{s.title}</h3>
                <p>{s.batch}</p>
              </div>
              <time dateTime={s.startsAt}>
                {new Date(s.startsAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}{' '}
                IST
              </time>
              <LmsStatusBadge status={s.status} />
            </li>
          ))}
        </ul>
        {!sessions.length && (
          <p className="lms-empty">
            No attendance records or applicable held sessions in this view.
          </p>
        )}
      </section>
    </>
  );
}
