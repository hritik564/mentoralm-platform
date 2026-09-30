'use client';
import { useClerk } from '@clerk/nextjs';
import { useRef, useState } from 'react';
import type { StudentProfile } from '../../../lib/dashboard/profile';
import { UserAvatar } from '../../auth/UserAvatar';
import { DashboardPageHeader } from '../DashboardPageHeader';
import { useDashboardTheme } from '../theme/DashboardTheme';
export function StudentProfilePage({ profile }: { profile: StudentProfile }) {
  const { openUserProfile } = useClerk();
  const { theme } = useDashboardTheme();
  const section = useRef<HTMLElement>(null);
  const [error, setError] = useState('');
  function manageAccount() {
    setError('');
    try {
      const style = getComputedStyle(section.current!);
      openUserProfile({
        appearance: {
          variables: {
            colorBackground: style.getPropertyValue('--dash-surface').trim(),
            colorForeground: style.getPropertyValue('--dash-text').trim(),
            colorMutedForeground: style.getPropertyValue('--dash-muted').trim(),
          },
        },
        getContainer: () =>
          section.current?.closest<HTMLElement>('.dashboard-shell') || null,
      });
    } catch {
      setError('Account management is unavailable. Please try again.');
    }
  }
  return (
    <section className="d3-page" ref={section}>
      <DashboardPageHeader
        title="Profile"
        description="Your information and account settings, together in one place."
      />
      <div className="d3-profile-grid">
        <section className="d3-panel" aria-labelledby="personal-title">
          <div className="d3-personal-heading">
            <UserAvatar user={profile} />
            <div>
              <h2 id="personal-title">Personal Information</h2>
              <p className="d3-muted">
                Your authenticated account information.
              </p>
            </div>
          </div>
          <dl className="d3-profile-fields">
            {[
              ['First name', profile.firstName],
              ['Last name', profile.lastName],
              ['Email', profile.email],
              ['Phone', profile.phone],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || 'Not provided'}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="d3-panel" aria-labelledby="education-title">
          <h2 id="education-title">Education & Career</h2>
          {profile.education ? (
            <dl className="d3-profile-fields">
              {[
                ['Education level', profile.education.level],
                ['Institution', profile.education.institution],
                [
                  'Graduation year',
                  profile.education.graduationYear?.toString(),
                ],
                ['Interests', profile.education.interests.join(', ')],
                ['Career goals', profile.education.careerGoals],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || 'Not provided'}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <>
              <span className="d3-badge">In development</span>
              <p className="d3-muted">
                A space for your education, interests and career goals. These
                MentoraLM profile fields are not connected yet.
              </p>
            </>
          )}
        </section>
        <section className="d3-panel" aria-labelledby="account-title">
          <h2 id="account-title">Account</h2>
          <p className="d3-muted">
            Manage your identity, contact details and account through the secure
            provider flow.
          </p>
          <button className="d3-secondary" onClick={manageAccount}>
            Manage account
          </button>
          <p role="alert" className="d3-error">
            {error}
          </p>
        </section>
        <section className="d3-panel" aria-labelledby="preferences-title">
          <h2 id="preferences-title">Preferences</h2>
          <p className="d3-muted">
            Appearance: <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>.
            Use the top bar toggle to change the theme on this device.
          </p>
          <p className="d3-muted">
            Notification preferences will be available in a future update.
          </p>
        </section>
        <section
          className="d3-panel d3-profile-security"
          aria-labelledby="security-title"
        >
          <h2 id="security-title">Security & Privacy</h2>
          <p className="d3-muted">
            Password and account security are managed securely through Clerk.
            Available options depend on your account configuration.
          </p>
          <button className="d3-secondary" onClick={manageAccount}>
            Open account security
          </button>
          <p className="d3-muted">
            MentoraLM privacy preferences will be connected in a future update.
          </p>
        </section>
      </div>
    </section>
  );
}
