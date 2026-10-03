'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminData, useAdminMutation } from '../client';
import { Field, FormActions } from '../academic/forms';
import { Pill, AdminDialog } from '../Primitives';
import { OperationalFrame, RecordText } from './Frame';
import { adminHref } from '@/lib/platform/domains';
import type { Certificate } from './types';
import type { Choice, StudentList } from '../types';
export function CertificateDetail({ reference }: { reference: string }) {
  const [action, setAction] = useState<'SUSPEND' | 'RESTORE' | 'REVOKE' | null>(
      null,
    ),
    path = `operations/certificates/${reference}`,
    data = useAdminData<Certificate>(path),
    c = data.data,
    mutation = useAdminMutation(() => {
      data.reload();
      setAction(null);
    });
  return (
    <OperationalFrame
      area="certificates"
      title={c?.code || 'Certificate'}
      data={data}
    >
      {c && (
        <section className="admin-card ops-detail">
          <h2>{c.course}</h2>
          <p>
            {c.student.name} · <Pill>{c.status}</Pill> ·{' '}
            {c.adminSuspended ? 'Admin hold active' : 'No Admin hold'}
          </p>
          <dl className="admin-key-values">
            <RecordText
              label="Issued"
              value={new Date(c.issuedAt).toLocaleString('en-GB')}
            />
            <RecordText
              label="First completion"
              value={
                c.firstCompletedAt
                  ? new Date(c.firstCompletedAt).toLocaleString('en-GB')
                  : null
              }
            />
            <RecordText
              label="Document"
              value={
                c.documentAvailable
                  ? 'Existing private document attached'
                  : 'No certificate file available'
              }
            />
          </dl>
          <p className="admin-muted">
            Restore clears the administrative hold and rechecks current
            eligibility. An ineligible certificate stays non-active. Revocation
            cannot be reversed here.
          </p>
          <div className="academic-actions">
            {(['SUSPEND', 'RESTORE', 'REVOKE'] as const).map((a) => (
              <button
                key={a}
                className="admin-button secondary"
                disabled={c.status === 'REVOKED'}
                onClick={() => setAction(a)}
              >
                {a === 'SUSPEND'
                  ? 'Suspend certificate'
                  : a === 'RESTORE'
                    ? 'Restore / recheck eligibility'
                    : 'Revoke certificate'}
              </button>
            ))}
          </div>
        </section>
      )}
      {c && action && (
        <AdminDialog
          title={`${action} certificate`}
          onClose={() => setAction(null)}
        >
          <form
            className="admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              await mutation.save(`${path}/state`, {
                action,
                reason: new FormData(e.currentTarget).get('reason'),
              });
            }}
          >
            <p>
              {action === 'REVOKE'
                ? 'This revocation is terminal under current policy.'
                : 'Learning completion is unchanged; certificate policy remains authoritative.'}
            </p>
            <Field label="Certificate action reason">
              <textarea name="reason" maxLength={500} required />
            </Field>
            <FormActions busy={mutation.busy} notice={mutation.notice} />
          </form>
        </AdminDialog>
      )}
    </OperationalFrame>
  );
}
export function CertificateIssue() {
  const [query, setQuery] = useState(''),
    [courseQuery, setCourseQuery] = useState(''),
    students = useAdminData<StudentList>(
      query ? `students?q=${encodeURIComponent(query)}` : null,
    ),
    courses = useAdminData<Choice[]>(
      `choices/courses?q=${encodeURIComponent(courseQuery)}`,
    ),
    router = useRouter(),
    mutation = useAdminMutation(() => {});
  return (
    <>
      <h1>Check certificate policy / issue</h1>
      <section className="admin-card">
        <p>
          Eligibility, entitlement and Enrollment are checked server-side. This
          action cannot create learning completion or a PDF.
        </p>
        <form
          className="admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              r = await mutation.save('operations/certificates/issue', {
                userId: f.get('student'),
                courseId: f.get('course'),
              });
            if (r?.ref) router.push(adminHref(`/admin/certificates/${r.ref}`));
          }}
        >
          <Field label="Find Student">
            <input
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              required
            />
          </Field>
          <Field label="Student">
            <select name="student" required>
              <option value="">Select Student</option>
              {students.data?.rows.map((s) => (
                <option key={s.ref} value={s.ref}>
                  {s.identity.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Find Course">
            <input
              value={courseQuery}
              maxLength={100}
              onChange={(e) => setCourseQuery(e.target.value)}
            />
          </Field>
          <Field label="Course">
            <select name="course" required>
              <option value="">Select Course</option>
              {courses.data?.map((c) => (
                <option key={c.ref} value={c.ref}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <FormActions busy={mutation.busy} notice={mutation.notice} />
        </form>
      </section>
    </>
  );
}
