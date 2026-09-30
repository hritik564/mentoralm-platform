'use client';
import { useState } from 'react';
import {
  browserReferralSharing,
  resolveReferralLink,
  type ReferralRegistry,
  type ReferralSharing,
  type ReferralSummary,
} from '../../../lib/dashboard/referral';
import { DashboardPageHeader } from '../DashboardPageHeader';
import { DashboardIcon } from '../DashboardIcon';
export function ReferralPage({
  summary,
  registry,
  sharing,
}: {
  summary: ReferralSummary | null;
  registry?: ReferralRegistry;
  sharing?: ReferralSharing;
}) {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const link = summary
    ? resolveReferralLink(summary.linkTargetId, registry)
    : null;
  async function activate(action: 'copy' | 'share') {
    if (!link) return;
    setBusy(true);
    setNotice('');
    try {
      const adapter = sharing || browserReferralSharing();
      if (action === 'share' && adapter.share) {
        await adapter.share(link);
        setNotice('Share dialog opened.');
      } else {
        await adapter.copy(link);
        setNotice(
          action === 'share'
            ? 'Sharing is unavailable on this device. Link copied instead.'
            : 'Referral link copied.',
        );
      }
    } catch (error) {
      setNotice(
        error instanceof Error && error.name === 'AbortError'
          ? 'Sharing cancelled.'
          : 'Unable to copy or share. You can select and copy the link below.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="d3-page">
      <DashboardPageHeader
        title="Referral"
        description="Your space to share MentoraLM and follow your invitations."
      />
      {summary && link ? (
        <>
          <section className="d3-panel" aria-labelledby="referral-link-title">
            <h2 id="referral-link-title">Your referral link</h2>
            <p className="d3-muted">
              Personal code: <strong>{summary.code}</strong>
            </p>
            <label className="d3-referral-link">
              Referral link
              <input
                readOnly
                value={link}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <div className="d3-actions">
              <button
                className="d3-button"
                disabled={busy}
                onClick={() => activate('copy')}
              >
                Copy Link
              </button>
              <button
                className="d3-secondary"
                disabled={busy}
                onClick={() => activate('share')}
              >
                Share
              </button>
            </div>
            <p role="status" className="d3-feedback">
              {notice}
            </p>
          </section>
          <section
            className="d3-panel"
            aria-labelledby="referral-history-title"
          >
            <h2 id="referral-history-title">Referral history</h2>
            {summary.history.length ? (
              <ul className="d3-history">
                {summary.history.map((record) => (
                  <li key={record.id}>
                    <div>
                      <strong>{record.displayName}</strong>
                      <p>
                        <time dateTime={record.date}>
                          {new Date(record.date).toLocaleDateString('en-US', {
                            timeZone: 'UTC',
                          })}
                        </time>
                      </p>
                    </div>
                    <span className="d3-badge">
                      {
                        {
                          invited: 'Invited',
                          joined: 'Joined',
                          qualified: 'Qualified',
                        }[record.status]
                      }
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="d3-muted">No referral activity yet.</p>
            )}
          </section>
        </>
      ) : (
        <div className="d3-empty">
          <span className="d3-surface-icon" aria-hidden="true">
            <DashboardIcon name="referral" />
          </span>
          <h2>Your referral space is ready.</h2>
          <p>
            Your personal code, sharing link and referral activity will appear
            once referrals are available.
          </p>
          <span className="d3-badge">Not configured yet</span>
        </div>
      )}
      <p className="d3-page-note">
        Referral terms and qualification rules will be shared when the program
        is available.
      </p>
    </section>
  );
}
