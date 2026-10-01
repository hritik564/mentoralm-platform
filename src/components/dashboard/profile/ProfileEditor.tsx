'use client';
import { useState } from 'react';
import type { StudentProfile } from '../../../lib/dashboard/profile';
import { studentRequest } from '../../../lib/dashboard/student-client';
import { DashboardDialog } from '../DashboardDialog';
export function ProfileEditor({
  education,
  onClose,
  onSaved,
}: {
  education: StudentProfile['education'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <DashboardDialog title="Education & Career" onClose={onClose}>
      <form
        className="d3-form"
        aria-describedby="profile-feedback"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setNotice('');
          const fields = new FormData(event.currentTarget);
          const text = (key: string) =>
            String(fields.get(key) || '').trim() || null;
          try {
            await studentRequest('profile', 'PATCH', {
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
        <label htmlFor="education-level">Education level</label>
        <input
          id="education-level"
          name="educationLevel"
          maxLength={80}
          defaultValue={education?.level || ''}
        />
        <label htmlFor="institution">Institution</label>
        <input
          id="institution"
          name="institution"
          maxLength={160}
          defaultValue={education?.institution || ''}
        />
        <label htmlFor="graduation-year">Graduation year</label>
        <input
          id="graduation-year"
          name="graduationYear"
          type="number"
          min={1900}
          max={2200}
          defaultValue={education?.graduationYear || ''}
        />
        <label htmlFor="interests">Interests</label>
        <p id="interests-hint" className="d3-muted">
          Separate up to 12 interests with commas.
        </p>
        <input
          id="interests"
          name="interests"
          aria-describedby="interests-hint"
          maxLength={732}
          defaultValue={education?.interests.join(', ') || ''}
        />
        <label htmlFor="career-goals">Career goals</label>
        <textarea
          id="career-goals"
          name="careerGoals"
          maxLength={1000}
          rows={4}
          defaultValue={education?.careerGoals || ''}
        />
        <p id="profile-feedback" role="status">
          {notice}
        </p>
        <div className="d3-actions">
          <button className="d3-button" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
          <button className="d3-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </DashboardDialog>
  );
}
