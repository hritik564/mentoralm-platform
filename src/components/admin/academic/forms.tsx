'use client';
import {
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
} from 'react';
import { useAdminData, useAdminMutation } from '../client';
import { AdminDialog } from '../Primitives';
import type { Builder, Choices } from './types';
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="academic-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id })
        : children}
    </div>
  );
}
export function Notice({ message }: { message: string }) {
  return message ? (
    <p className="academic-notice" role="alert">
      {message}
    </p>
  ) : null;
}
export function FormActions({
  busy,
  notice,
}: {
  busy: boolean;
  notice: string;
}) {
  return (
    <>
      <Notice message={notice} />
      <button className="admin-button" disabled={busy} type="submit">
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </>
  );
}
export function TitleEditor({
  kind,
  initial,
  onClose,
  onSaved,
}: {
  kind: 'programs' | 'banks';
  initial?: { ref: string; title: string };
  onClose: () => void;
  onSaved: (ref: string) => void;
}) {
  const mutation = useAdminMutation(() => {});
  return (
    <AdminDialog
      title={`${initial ? 'Edit' : 'Create'} ${kind === 'programs' ? 'Program' : 'Question Bank'}`}
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await mutation.save(
            `academic/${kind}${initial ? `/${initial.ref}` : ''}`,
            { title: new FormData(e.currentTarget).get('title') },
          );
          if (r?.ref) {
            onSaved(r.ref);
            onClose();
          }
        }}
      >
        <Field label="Title">
          <input
            name="title"
            defaultValue={initial?.title || ''}
            required
            maxLength={160}
          />
        </Field>
        <p className="admin-muted">
          This model has title metadata only. Publication is managed on Courses
          or Questions.
        </p>
        <FormActions busy={mutation.busy} notice={mutation.notice} />
      </form>
    </AdminDialog>
  );
}
export function CourseEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Builder;
  onClose: () => void;
  onSaved: (ref: string) => void;
}) {
  const [programQuery, setProgramQuery] = useState(''),
    programs = useAdminData<Choices>(
      `choices/programs?q=${encodeURIComponent(programQuery)}`,
    ),
    mutation = useAdminMutation(() => {}),
    [program, setProgram] = useState(initial?.programRef || '');
  return (
    <AdminDialog
      title={initial ? 'Course metadata' : 'Create Course'}
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const r = await mutation.save(
            `academic/courses${initial ? `/${initial.ref}` : ''}`,
            {
              title: f.get('title'),
              description: f.get('description'),
              programId: program || null,
              thumbnailPath: f.get('thumbnail'),
              thumbnailAlt: f.get('alt'),
              publicPath: '/#programs',
              published: initial?.published || false,
              academicCompletionEnabled: f.has('completion'),
              certificateEnabled: f.has('certificate'),
              requiredAttendancePercent:
                f.get('attendance') !== '' ? Number(f.get('attendance')) : null,
            },
          );
          if (r?.ref) {
            onSaved(r.ref);
            onClose();
          }
        }}
      >
        <Field label="Course title">
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={initial?.title || ''}
          />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            required
            maxLength={4000}
            defaultValue={initial?.description || ''}
          />
        </Field>
        <Field label="Find Program">
          <input
            value={programQuery}
            maxLength={100}
            placeholder="Search Program title"
            onChange={(e) => setProgramQuery(e.target.value)}
          />
        </Field>
        <Field label="Program">
          <select value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="">Independent Course</option>
            {program && !programs.data?.some((p) => p.ref === program) && (
              <option value={program}>Current selected Program</option>
            )}
            {programs.data?.map((p) => (
              <option key={p.ref} value={p.ref}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Thumbnail">
          <select
            name="thumbnail"
            defaultValue={initial?.thumbnailPath || '/images/campus.webp'}
          >
            {[
              'campus',
              'learner',
              'collaboration',
              'entrepreneurship',
              'counsellor',
            ].map((n) => (
              <option key={n} value={`/images/${n}.webp`}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Thumbnail alternative text">
          <input
            name="alt"
            required
            maxLength={160}
            defaultValue={initial?.thumbnailAlt || 'Learning at MentoraLM'}
          />
        </Field>
        <label className="academic-check">
          <input
            name="completion"
            type="checkbox"
            defaultChecked={initial?.academicCompletionEnabled || false}
          />{' '}
          Enable academic completion
        </label>
        <label className="academic-check">
          <input
            name="certificate"
            type="checkbox"
            defaultChecked={initial?.certificateEnabled || false}
          />{' '}
          Enable certificate eligibility
        </label>
        <Field label="Required attendance percentage (optional)">
          <input
            name="attendance"
            type="number"
            min={0}
            max={100}
            defaultValue={initial?.requiredAttendancePercent ?? ''}
          />
        </Field>
        <p className="admin-muted">
          Completion/certificate policy is locked after Enrollment. Metadata
          changes do not create or change Enrollments. New Courses start as
          drafts.
        </p>
        <FormActions busy={mutation.busy} notice={mutation.notice} />
      </form>
    </AdminDialog>
  );
}
export function StructureEditor({
  kind,
  courseRef,
  sectionRef,
  initial,
  onClose,
  onSaved,
}: {
  kind: 'section' | 'item';
  courseRef: string;
  sectionRef?: string;
  initial?: {
    ref: string;
    title: string;
    description?: string | null;
    type?: string;
    required?: boolean;
    published: boolean;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const mutation = useAdminMutation(onSaved);
  return (
    <AdminDialog
      title={`${initial ? 'Edit' : 'Add'} ${kind === 'section' ? 'Section' : 'learning item'}`}
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const body =
            kind === 'section'
              ? {
                  title: f.get('title'),
                  description: f.get('description') || null,
                  published: initial?.published || false,
                }
              : {
                  title: f.get('title'),
                  type: f.get('type'),
                  required: f.has('required'),
                  published: false,
                };
          const r = await mutation.save(
            `academic/courses/${courseRef}/sections${kind === 'item' ? `/${sectionRef}/items` : ''}${initial ? `/${initial.ref}` : ''}`,
            body,
          );
          if (r) onClose();
        }}
      >
        <Field label="Title">
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={initial?.title || ''}
          />
        </Field>
        {kind === 'section' ? (
          <Field label="Section description">
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={initial?.description || ''}
            />
          </Field>
        ) : (
          <>
            <Field label="Learning item type">
              <select name="type" defaultValue="LESSON">
                {[
                  'LESSON',
                  'QUIZ',
                  'ASSIGNMENT',
                  'RESOURCE',
                  'LIVE_SESSION',
                  'ASSESSMENT',
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <label className="academic-check">
              <input type="checkbox" name="required" defaultChecked /> Required
              for learning progress where supported
            </label>
          </>
        )}
        <p className="admin-muted">
          New content starts as draft. Configure the item before publishing.
        </p>
        <FormActions busy={mutation.busy} notice={mutation.notice} />
      </form>
    </AdminDialog>
  );
}
