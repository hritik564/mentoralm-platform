'use client';
import Link from 'next/link';
import { useState } from 'react';
import { adminHref } from '@/lib/platform/domains';
import { useAdminData, useAdminMutation } from '../client';
import { Field, FormActions } from './forms';
import { Pill, Table, State } from '../Primitives';
import type { ItemDetail } from './types';
import type { BatchDetail } from '../types';
export function LiveEditor({
  item,
  path,
  courseRef,
  onSaved,
}: {
  item: ItemDetail;
  path: string;
  courseRef: string;
  onSaved: () => void;
}) {
  const batches = useAdminData<{ ref: string; name: string }[]>(
      `academic/live-batches?course=${courseRef}`,
    ),
    [batch, setBatch] = useState(''),
    detail = useAdminData<BatchDetail>(batch ? `batches/${batch}` : null),
    mutation = useAdminMutation(onSaved);
  return (
    <section className="academic-editor-panel">
      <h3>Live Session academic context</h3>
      <p className="admin-muted">
        One LIVE_SESSION item → multiple Batch-specific occurrences → attendance
        and recording. Each occurrence keeps its own date, Instructor and
        authorized meeting target. Watching a recording never changes
        attendance.
      </p>
      <Table
        caption="Associated Batch session occurrences"
        headers={['Occurrence', 'Batch', 'Starts', 'Status', 'Recording']}
      >
        {item.sessions.map((s) => (
          <tr key={s.ref}>
            <td>{s.title}</td>
            <td>
              <Link href={adminHref(`/admin/batches/${s.batchRef}`)}>
                {s.batch}
              </Link>
            </td>
            <td>{new Date(s.startsAt).toLocaleString('en-GB')}</td>
            <td>
              <Pill>{s.status}</Pill>
            </td>
            <td>{s.recording}</td>
          </tr>
        ))}
      </Table>
      {!item.sessions.length && (
        <p>
          No occurrences linked. The academic item may remain a placeholder
          until scheduling.
        </p>
      )}
      <p className="admin-muted">
        Latest 50 occurrences. Manage attendance/recording foundations in the
        existing Batch Live Sessions view. Recording uploads require a
        configured provider. To link an existing occurrence, open its Batch Live
        Sessions view and select this Course and LIVE_SESSION item; sessions
        with attendance or recording history cannot be rebound.
      </p>
      <h3>Add Batch occurrence</h3>
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await mutation.save(`${path}/occurrences`, {
            batchRef: batch,
            title: f.get('title'),
            startsAt: new Date(String(f.get('start'))).toISOString(),
            endsAt: new Date(String(f.get('end'))).toISOString(),
            status: f.get('status'),
            instructorId: f.get('instructor') || null,
            externalTargetId: f.get('meeting') || null,
            locationLabel: f.get('location') || null,
          });
        }}
      >
        <Field label="Applicable Batch">
          <select
            required
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
          >
            <option value="">Select Batch</option>
            {batches.data?.map((b) => (
              <option key={b.ref} value={b.ref}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <State {...detail} />
        <Field label="Occurrence title">
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={item.title}
          />
        </Field>
        <div className="academic-form-grid">
          <Field label="Starts (local time)">
            <input name="start" type="datetime-local" required />
          </Field>
          <Field label="Ends (local time)">
            <input name="end" type="datetime-local" required />
          </Field>
        </div>
        <Field label="Session status">
          <select name="status">
            <option>SCHEDULED</option>
            <option>HELD</option>
            <option>CANCELLED</option>
          </select>
        </Field>
        <Field label="Assigned Instructor">
          <select name="instructor">
            <option value="">Not assigned</option>
            {detail.data?.instructors.map((i) => (
              <option key={i.ref} value={i.ref}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Approved meeting destination">
          <select name="meeting">
            <option value="">Not configured</option>
            {item.externalTargets.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Location label (optional)">
          <input name="location" maxLength={160} />
        </Field>
        <FormActions busy={mutation.busy} notice={mutation.notice} />
      </form>
    </section>
  );
}
