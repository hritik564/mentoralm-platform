'use client';
import { useState } from 'react';
import { useAdminData, useAdminMutation } from './client';
import { AdminDialog, State } from './Primitives';
import type { Choice, BatchDetail } from './types';
import { useRouter } from 'next/navigation';
import { adminHref } from '@/lib/platform/domains';
export function localDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function iso(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value
    ? new Date(value).toISOString()
    : null;
}
export function BatchEditor({
  batch,
  onClose,
  onSaved,
}: {
  batch?: BatchDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [courseRef, setCourseRef] = useState(batch?.courseRef || ''),
    [programRef, setProgramRef] = useState(batch?.programRef || ''),
    router = useRouter(),
    courses = useAdminData<Choice[]>('choices/courses'),
    programs = useAdminData<Choice[]>('choices/programs'),
    mutation = useAdminMutation(onSaved);
  return (
    <AdminDialog
      title={batch ? 'Edit Batch' : 'Create Batch'}
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          if (
            batch?.access &&
            !f.has('access') &&
            !confirm(
              'Disable Batch LMS access? Individual overrides will remain unchanged.',
            )
          )
            return;
          const r = await mutation.save(
            `batches${batch ? `/${batch.ref}` : ''}`,
            {
              code: f.get('code'),
              name: f.get('name'),
              status: f.get('status'),
              courseId: f.get('course') || null,
              programId: f.get('program') || null,
              startsAt: iso(f.get('starts')),
              endsAt: iso(f.get('ends')),
              lmsAccessEnabled: f.has('access'),
            },
          );
          if (r) {
            onClose();
            if (!batch && r.ref)
              router.push(adminHref(`/admin/batches/${r.ref}`));
          }
        }}
      >
        <label>
          Batch code
          <input
            name="code"
            pattern="[A-Z0-9][A-Z0-9_-]{2,39}"
            title="3–40 uppercase letters, numbers, underscores or hyphens"
            required
            maxLength={40}
            defaultValue={batch?.code}
          />
        </label>
        <label>
          Batch name
          <input
            name="name"
            required
            maxLength={160}
            defaultValue={batch?.name}
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={batch?.status || 'PLANNED'}>
            {['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Course scope
          <select
            name="course"
            value={courseRef}
            onChange={(e) => setCourseRef(e.target.value)}
          >
            <option value="">No Course scope</option>
            {courses.data?.map((c) => (
              <option key={c.ref} value={c.ref}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Program scope
          <select
            name="program"
            value={programRef}
            onChange={(e) => setProgramRef(e.target.value)}
          >
            <option value="">No Program scope</option>
            {programs.data?.map((c) => (
              <option key={c.ref} value={c.ref}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-form-pair">
          <label>
            Starts at
            <input
              type="datetime-local"
              name="starts"
              defaultValue={localDate(batch?.starts || null)}
            />
          </label>
          <label>
            Ends at
            <input
              type="datetime-local"
              name="ends"
              defaultValue={localDate(batch?.ends || null)}
            />
          </label>
        </div>
        <label className="admin-check">
          <input
            type="checkbox"
            name="access"
            defaultChecked={batch?.access || false}
          />{' '}
          Enable inherited Batch LMS access
        </label>
        <p className="admin-muted">
          Select either Course or Program scope. Membership does not create
          Enrollment. Individual overrides take precedence.
        </p>
        <State
          loading={courses.loading || programs.loading}
          error={courses.error || programs.error}
          reload={() => {
            courses.reload();
            programs.reload();
          }}
        />
        <State loading={false} error={courses.error} reload={courses.reload} />
        <p role="status">{mutation.notice}</p>
        <div className="admin-actions">
          <button
            className="admin-button"
            disabled={mutation.busy || courses.loading || programs.loading}
          >
            Save Batch
          </button>
          <button
            type="button"
            className="admin-button secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
export function SessionEditor({
  batch,
  session,
  onClose,
  onSaved,
}: {
  batch: BatchDetail;
  session?: BatchDetail['sessions'][number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [course, setCourse] = useState(
      session?.courseRef || batch.courseRef || '',
    ),
    [item, setItem] = useState(session?.itemRef || ''),
    courses = useAdminData<Choice[]>('choices/courses'),
    items = useAdminData<Choice[]>(
      course ? `choices/items?course=${encodeURIComponent(course)}` : null,
    ),
    mutation = useAdminMutation(onSaved);
  return (
    <AdminDialog
      title={session ? 'Edit Live Session' : 'Add Live Session'}
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          const r = await mutation.save(
            `batches/${batch.ref}/sessions${session ? `/${session.ref}` : ''}`,
            {
              title: f.get('title'),
              courseId: course || null,
              itemId: f.get('item') || null,
              instructorId: f.get('instructor') || null,
              startsAt: iso(f.get('starts')),
              endsAt: iso(f.get('ends')),
              status: f.get('status'),
              locationLabel: f.get('location') || null,
              externalTargetId: f.get('target') || null,
            },
          );
          if (r) onClose();
        }}
      >
        <label>
          Title
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={session?.title}
          />
        </label>
        <label>
          Course
          <select
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setItem('');
            }}
          >
            <option value="">No Course context</option>
            {courses.data?.map((c) => (
              <option key={c.ref} value={c.ref}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          LIVE_SESSION learning item
          <select
            name="item"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          >
            <option value="">No linked item yet</option>
            {items.data?.map((c) => (
              <option key={c.ref} value={c.ref}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <p className="admin-muted">
          A published recording requires a matching published LIVE_SESSION item.
          Item authoring is deferred.
        </p>
        <label>
          Session instructor
          <select name="instructor" defaultValue={session?.instructorRef || ''}>
            <option value="">Not assigned</option>
            {batch.instructors.map((i) => (
              <option key={i.ref} value={i.ref}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-form-pair">
          <label>
            Starts at
            <input
              type="datetime-local"
              name="starts"
              required
              defaultValue={localDate(session?.starts || null)}
            />
          </label>
          <label>
            Ends at
            <input
              type="datetime-local"
              name="ends"
              required
              defaultValue={localDate(session?.ends || null)}
            />
          </label>
        </div>
        <label>
          Status
          <select name="status" defaultValue={session?.status || 'SCHEDULED'}>
            {['SCHEDULED', 'HELD', 'CANCELLED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Location label
          <input
            name="location"
            maxLength={160}
            defaultValue={session?.location || ''}
          />
        </label>
        <label>
          Approved meeting target ID
          <input
            name="target"
            maxLength={100}
            defaultValue={session?.externalTargetId || ''}
          />
        </label>
        <p className="admin-muted">
          Meeting destinations use the platform’s configured HTTPS target
          registry. No Zoom integration.
        </p>
        <State loading={false} error={courses.error} reload={courses.reload} />
        <p role="status">{mutation.notice}</p>
        <div className="admin-actions">
          <button
            className="admin-button"
            disabled={mutation.busy || courses.loading || items.loading}
          >
            Save session
          </button>
          <button
            className="admin-button secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
