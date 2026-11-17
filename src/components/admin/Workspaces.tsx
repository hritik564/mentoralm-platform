'use client';
import Link from 'next/link';
import { adminHref } from '@/lib/platform/domains';
import { adminWorkspaces, workspaceDestinations } from '@/lib/admin/navigation';
import { useAdminAccess } from './AdminShell';
import { AdminIcon } from './AdminIcon';
import { LearningHome } from './LearningHome';
export { LearningSessions } from './LearningDelivery';
export function AdminQuickActions({ compact = false }: { compact?: boolean }) {
  const { permissions } = useAdminAccess();
  const actions = [
    {
      label: 'Create Course',
      description: 'Build a new learning experience',
      path: '/admin/courses',
      query: '?create=course',
      permission: 'ACADEMICS_MANAGE',
      icon: 'courses',
    },
    {
      label: 'Create Batch',
      description: 'Bring your next cohort together',
      path: '/admin/batches',
      query: '?create=batch',
      permission: 'BATCHES_MANAGE',
      icon: 'batches',
    },
    {
      label: 'Schedule Class',
      description: 'Choose a Batch and plan a session',
      path: '/admin/learning/classes',
      query: '',
      permission: 'BATCHES_MANAGE',
      icon: 'calendar',
    },
    ...(!compact
      ? [
          {
            label: 'Publish Recording',
            description: 'Publishing is not configured',
            path: '/admin/learning/recordings',
            query: '',
            permission: 'BATCHES_MANAGE',
            icon: 'video',
          },
        ]
      : []),
  ].filter((a) => permissions.some((p) => p === a.permission));
  if (!actions.length) return null;
  return (
    <section
      className={`admin-quick-section ${compact ? 'is-compact' : ''}`}
      aria-label="Quick actions"
    >
      <div className="admin-quick-actions">
        {actions.map((a) => (
          <Link
            key={a.label}
            className={`admin-quick-action ${a.icon === 'video' ? 'is-unconfigured' : ''}`}
            href={`${adminHref(a.path)}${a.query}`}
          >
            <span className="admin-action-icon">
              <AdminIcon name={a.icon} />
            </span>
            <span>
              <strong>{a.label}</strong>
              <small>{a.description}</small>
            </span>
            <span className="admin-action-arrow">
              <AdminIcon name={a.icon === 'video' ? 'arrow' : 'plus'} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
export function AdminWorkspace({
  kind,
}: {
  kind: 'learning' | 'people' | 'inbox';
}) {
  const { permissions } = useAdminAccess();
  const workspace = adminWorkspaces.find((w) => w.id === kind)!;
  const destinations = workspaceDestinations(kind, permissions);
  if (kind === 'learning')
    return <LearningHome actions={<AdminQuickActions compact />} />;
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Admin workspace</p>
          <h1>{workspace.label}</h1>
          <p>{workspace.description}</p>
        </div>
        <span className="admin-workspace-emblem">
          <AdminIcon name={kind} />
        </span>
      </div>
      <section
        className="admin-workspace-cards"
        aria-label={`${workspace.label} areas`}
      >
        {destinations
          .filter((d) => d.primary)
          .map((d) => (
            <Link
              className="admin-workspace-card admin-card"
              key={d.href}
              href={adminHref(d.href)}
            >
              <span className="admin-action-icon">
                <AdminIcon name={d.icon} />
              </span>
              <h2>{d.label}</h2>
              <p>{d.description}</p>
              <span className="admin-workspace-open">
                Open workspace <AdminIcon name="arrow" />
              </span>
            </Link>
          ))}
      </section>
      {kind === 'people' && (
        <p className="admin-workspace-note">
          <AdminIcon name="shield" /> Role and permission changes continue
          through the existing governed access controls.
        </p>
      )}
      {kind === 'inbox' && (
        <p className="admin-workspace-note">
          <AdminIcon name="message" /> Support, discussions and communication
          plans keep their own conversations and permissions.
        </p>
      )}
    </>
  );
}
