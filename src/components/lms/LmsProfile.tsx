'use client';
import Link from 'next/link';
import { useClerk } from '@clerk/nextjs';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StudentProfile } from '@/lib/dashboard/profile';
import type { getLmsIdentity } from '@/lib/lms/services';
import { lmsHref } from '@/lib/platform/domains';
import { UserAvatar } from '../auth/UserAvatar';
import { DashboardDialog } from '../dashboard/DashboardDialog';
import { LmsPageHeader, LmsSectionCard } from './LmsPrimitives';
import { lmsAccountRequest } from './account-client';
function Fields({
  fields,
}: {
  fields: readonly (readonly [string, string | null | undefined])[];
}) {
  return (
    <dl className="lms-profile-fields">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || 'Not provided'}</dd>
        </div>
      ))}
    </dl>
  );
}
export function LmsProfile({
  profile,
  identity,
  courses,
}: {
  profile: StudentProfile;
  identity: Awaited<ReturnType<typeof getLmsIdentity>>;
  courses: readonly { id: string; title: string; program: string | null }[];
}) {
  const { openUserProfile } = useClerk();
  const section = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const router = useRouter();
  function manageAccount() {
    setError('');
    try {
      const shell = section.current?.closest<HTMLElement>('.lms-shell');
      if (!shell) throw Error('Account unavailable');
      const style = getComputedStyle(shell);
      openUserProfile({
        appearance: {
          variables: {
            colorBackground: style.getPropertyValue('--lms-panel').trim(),
            colorForeground: style.getPropertyValue('--lms-text').trim(),
            colorMutedForeground: style.getPropertyValue('--lms-muted').trim(),
          },
        },
        getContainer: () => shell,
      });
    } catch {
      setError('Account management is unavailable. Please try again.');
    }
  }
  const education = profile.education;
  return (
    <section ref={section}>
      <LmsPageHeader
        title="Profile"
        description="Your personal information, learning identity and account settings."
      />
      <div className="lms-profile-grid">
        <LmsSectionCard title="Personal information">
          <div className="lms-profile-person">
            <UserAvatar user={profile} />
            <strong>{profile.name || 'Your student account'}</strong>
          </div>
          <Fields
            fields={[
              ['First name', profile.firstName],
              ['Last name', profile.lastName],
              ['Email', profile.email],
              ['Phone', profile.phone],
            ]}
          />
          <button
            type="button"
            className="lms-secondary-action"
            onClick={manageAccount}
          >
            Manage personal details
          </button>
        </LmsSectionCard>
        <LmsSectionCard title="Learning identity">
          <Fields
            fields={[
              ['Student ID', identity.studentId],
              [
                'Current Batch',
                identity.currentBatch?.name ||
                  (identity.batches.length
                    ? 'No active batch'
                    : 'Batch not assigned'),
              ],
              ['Batch code', identity.currentBatch?.code || 'Not assigned'],
            ]}
          />
          <h3>Your available courses</h3>
          {courses.length ? (
            <ul className="lms-profile-courses">
              {courses.map((course) => (
                <li key={course.id}>
                  <Link
                    href={lmsHref(`/learn/courses/${course.id}`)}
                    prefetch={false}
                  >
                    {course.title} →
                  </Link>
                  <span className="lms-muted">
                    {course.program || 'Course'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lms-muted">No enrolled courses available yet.</p>
          )}
        </LmsSectionCard>
        <LmsSectionCard
          title="Education & career"
          action={
            <button
              type="button"
              className="lms-secondary-action"
              onClick={() => setEditing(true)}
            >
              Edit education & career
            </button>
          }
        >
          {education ? (
            <Fields
              fields={[
                ['Education level', education.level],
                ['Institution', education.institution],
                ['Graduation year', education.graduationYear?.toString()],
                ['Interests', education.interests.join(', ')],
                ['Career goals', education.careerGoals],
              ]}
            />
          ) : (
            <p className="lms-muted">
              Add your education, interests and career goals when you are ready.
            </p>
          )}
          <p role="status">{notice}</p>
        </LmsSectionCard>
        <LmsSectionCard title="Account & security">
          <p className="lms-muted">
            Manage your contact details, sign-in methods and account security
            through the secure account flow. Available controls depend on your
            account configuration.
          </p>
          <button
            type="button"
            className="lms-secondary-action"
            onClick={manageAccount}
          >
            Manage account & security
          </button>
          <p role="alert" className="lms-form-error">
            {error}
          </p>
        </LmsSectionCard>
      </div>
      {editing && (
        <EducationEditor
          education={education}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNotice('Profile saved.');
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
function EducationEditor({
  education,
  onClose,
  onSaved,
}: {
  education: StudentProfile['education'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  return (
    <DashboardDialog
      title="Education & career"
      className="lms-dialog"
      onClose={onClose}
    >
      <form
        className="lms-account-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setNotice('');
          const fields = new FormData(event.currentTarget);
          const text = (key: string) =>
            String(fields.get(key) || '').trim() || null;
          try {
            await lmsAccountRequest('profile', 'PATCH', {
              educationLevel: text('educationLevel'),
              institution: text('institution'),
              graduationYear: text('graduationYear')
                ? Number(text('graduationYear'))
                : null,
              interests: (text('interests') || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
              careerGoals: text('careerGoals'),
            });
            onSaved();
          } catch (error) {
            setNotice(
              error instanceof Error
                ? error.message
                : 'Unable to save your profile.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="lms-education-level">Education level</label>
        <input
          id="lms-education-level"
          name="educationLevel"
          maxLength={80}
          defaultValue={education?.level || ''}
        />
        <label htmlFor="lms-institution">Institution</label>
        <input
          id="lms-institution"
          name="institution"
          maxLength={160}
          defaultValue={education?.institution || ''}
        />
        <label htmlFor="lms-graduation-year">Graduation year</label>
        <input
          id="lms-graduation-year"
          name="graduationYear"
          type="number"
          min={1900}
          max={2200}
          defaultValue={education?.graduationYear || ''}
        />
        <label htmlFor="lms-interests">Interests</label>
        <input
          id="lms-interests"
          name="interests"
          maxLength={732}
          defaultValue={education?.interests.join(', ') || ''}
          aria-describedby="lms-interests-hint"
        />
        <p className="lms-muted" id="lms-interests-hint">
          Separate up to 12 interests with commas.
        </p>
        <label htmlFor="lms-career-goals">Career goals</label>
        <textarea
          id="lms-career-goals"
          name="careerGoals"
          rows={4}
          maxLength={1000}
          defaultValue={education?.careerGoals || ''}
        />
        <p role="status">{notice}</p>
        <div className="lms-account-actions">
          <button className="lms-action" disabled={busy} type="submit">
            {busy ? 'Saving…' : 'Save profile'}
          </button>
          <button
            className="lms-secondary-action"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </DashboardDialog>
  );
}
