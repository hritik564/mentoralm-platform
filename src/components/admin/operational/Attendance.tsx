'use client';
import { useAdminAccess } from '../AdminShell';
import { useState } from 'react';
import Link from 'next/link';
import { useAdminData, adminRequest } from '../client';
import { Field, Notice } from '../academic/forms';
import { Pager, Table, Pill } from '../Primitives';
import { OperationalFrame } from './Frame';
import { adminHref } from '@/lib/platform/domains';
import type { Session } from './types';
export function AttendanceSession({ reference }: { reference: string }) {
  const access = useAdminAccess();
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [states, setStates] = useState<Record<string, string>>({}),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [failures, setFailures] = useState<Record<string, string>>({});
  const path = `operations/attendance/${reference}`,
    data = useAdminData<Session>(`${path}?page=${page}`),
    s = data.data;
  const chosen = (status: string) =>
    setStates((old) => ({
      ...old,
      ...Object.fromEntries(selected.map((id) => [id, status])),
    }));
  return (
    <OperationalFrame
      area="attendance"
      title={s?.title || 'Session attendance'}
      data={data}
    >
      {s && (
        <>
          <section className="admin-card">
            <p>
              {s.batch} · {s.course} ·{' '}
              {new Date(s.startsAt).toLocaleString('en-GB')} ·{' '}
              <Pill>{s.status}</Pill>
            </p>
            <p className="admin-muted">
              Roster includes only membership windows covering the session
              start. Recording playback never changes attendance.
            </p>
            <Link href={adminHref(`/admin/batches/${s.batchRef}`)}>
              Open Batch Live Sessions →
            </Link>
            {s.status !== 'HELD' && (
              <p>Attendance is editable only for HELD sessions.</p>
            )}
          </section>
          <form
            className="admin-card admin-form ops-detail"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setNotice('');
              try {
                const reason = String(
                  new FormData(e.currentTarget).get('reason'),
                );
                const rows = s.rows
                  .filter((r) => selected.includes(r.student.ref))
                  .map((r) => ({
                    membershipId: r.membershipRef,
                    userId: r.student.ref,
                    status:
                      states[r.student.ref] ||
                      (r.status === 'UNRECORDED' ? 'PRESENT' : r.status),
                    reason,
                  }));
                const result = await adminRequest<{
                  results: {
                    userId: string;
                    saved: boolean;
                    error: string | null;
                  }[];
                }>(`${path}/save`, { rows });
                setFailures(
                  Object.fromEntries(
                    result.results
                      .filter((r) => !r.saved)
                      .map((r) => [r.userId, r.error || 'Not saved']),
                  ),
                );
                setNotice(
                  `${result.results.filter((r) => r.saved).length} saved; ${result.results.filter((r) => !r.saved).length} rejected. Each selected row was independently validated.`,
                );
                data.reload();
              } catch (error) {
                setNotice(
                  error instanceof Error
                    ? error.message
                    : 'Unable to save attendance.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="academic-actions">
              <button
                type="button"
                className="admin-button secondary"
                disabled={busy || s.status !== 'HELD'}
                onClick={() => setSelected(s.rows.map((r) => r.student.ref))}
              >
                Select this page
              </button>
              <button
                type="button"
                className="admin-button secondary"
                disabled={!selected.length || busy}
                onClick={() => chosen('PRESENT')}
              >
                Mark selected PRESENT
              </button>
              <button
                type="button"
                className="admin-button secondary"
                disabled={!selected.length || busy}
                onClick={() => chosen('ABSENT')}
              >
                Mark selected ABSENT
              </button>
            </div>
            <Table
              caption="Session attendance roster"
              headers={[
                'Select',
                'Student',
                'Previous state',
                'New state',
                'Recorded / result',
              ]}
            >
              {s.rows.map((r) => (
                <tr key={r.membershipRef}>
                  <td>
                    <input
                      aria-label={`Select ${r.student.name}`}
                      type="checkbox"
                      checked={selected.includes(r.student.ref)}
                      disabled={busy || s.status !== 'HELD'}
                      onChange={(e) =>
                        setSelected((old) =>
                          e.target.checked
                            ? [...old, r.student.ref]
                            : old.filter((id) => id !== r.student.ref),
                        )
                      }
                    />
                  </td>
                  <td>
                    {access.permissions.includes('STUDENTS_MANAGE') ? (
                      <Link
                        href={adminHref(`/admin/students/${r.student.ref}`)}
                      >
                        {r.student.name}
                      </Link>
                    ) : (
                      <span>{r.student.name}</span>
                    )}
                  </td>
                  <td>
                    <Pill>{r.status}</Pill>
                  </td>
                  <td>
                    <select
                      aria-label={`Attendance for ${r.student.name}`}
                      value={
                        states[r.student.ref] ||
                        (r.status === 'UNRECORDED' ? 'PRESENT' : r.status)
                      }
                      disabled={busy || s.status !== 'HELD'}
                      onChange={(e) =>
                        setStates((old) => ({
                          ...old,
                          [r.student.ref]: e.target.value,
                        }))
                      }
                    >
                      {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(
                        (status) => (
                          <option key={status}>{status}</option>
                        ),
                      )}
                    </select>
                  </td>
                  <td>
                    {failures[r.student.ref] ? (
                      <span role="alert">{failures[r.student.ref]}</span>
                    ) : r.recordedAt ? (
                      new Date(r.recordedAt).toLocaleString('en-GB')
                    ) : (
                      'Unrecorded'
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            <Field label="Entry / correction reason">
              <textarea
                name="reason"
                required
                maxLength={240}
                disabled={busy || s.status !== 'HELD'}
              />
            </Field>
            <Notice message={notice} />
            <button
              className="admin-button"
              disabled={!selected.length || busy || s.status !== 'HELD'}
            >
              {busy ? 'Saving…' : 'Save selected attendance'}
            </button>
          </form>
          <Pager
            page={page}
            total={s.total}
            onPage={(n) => {
              setPage(n);
              setSelected([]);
            }}
          />
        </>
      )}
    </OperationalFrame>
  );
}
