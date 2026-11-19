import type { AdminPermission } from '../../generated/prisma/client';
export type AdminWorkspaceId =
  | 'overview'
  | 'marketplace'
  | 'learning'
  | 'students'
  | 'people'
  | 'inbox'
  | 'settings';
export type AdminDestination = {
  label: string;
  href: string;
  permission: AdminPermission;
  description: string;
  icon: string;
  primary?: boolean;
};
export const adminWorkspaces: {
  id: AdminWorkspaceId;
  label: string;
  href: string;
  description: string;
  destinations: AdminDestination[];
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/admin',
    description: 'Your platform, at a glance.',
    destinations: [],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    href: '/admin/marketplace',
    description: 'Public offerings, pricing and catalogue publication.',
    destinations: [
      {
        label: 'Offerings',
        href: '/admin/marketplace',
        permission: 'MARKETPLACE_MANAGE',
        description: 'Manage the public catalogue and explicit publication.',
        icon: 'marketplace',
        primary: true,
      },
      {
        label: 'Orders',
        href: '/admin/marketplace/orders',
        permission: 'COMMERCE_VIEW',
        description: 'Inspect verified payments and purchased access.',
        icon: 'document',
        primary: true,
      },
    ],
  },
  {
    id: 'learning',
    label: 'Learning',
    href: '/admin/learning',
    description: 'Build learning experiences. Keep every cohort moving.',
    destinations: [
      {
        label: 'Courses',
        href: '/admin/courses',
        permission: 'ACADEMICS_MANAGE',
        description: 'Programs, courses and curriculum authoring.',
        icon: 'courses',
        primary: true,
      },
      {
        label: 'Batches',
        href: '/admin/batches',
        permission: 'BATCHES_MANAGE',
        description: 'Cohorts, membership and instructor assignments.',
        icon: 'batches',
        primary: true,
      },
      {
        label: 'Live Classes',
        href: '/admin/learning/classes',
        permission: 'BATCHES_MANAGE',
        description: 'Schedule and manage sessions within a Batch.',
        icon: 'calendar',
        primary: true,
      },
      {
        label: 'Recordings',
        href: '/admin/learning/recordings',
        permission: 'BATCHES_MANAGE',
        description: 'Session recordings and publication readiness.',
        icon: 'video',
        primary: true,
      },
      {
        label: 'Attendance',
        href: '/admin/attendance',
        permission: 'ATTENDANCE_MANAGE',
        description: 'Review and record session attendance.',
        icon: 'check',
      },
      {
        label: 'Assignments',
        href: '/admin/assignments',
        permission: 'ACADEMICS_MANAGE',
        description: 'Configure assignment learning activities.',
        icon: 'document',
      },
      {
        label: 'Assignment Reviews',
        href: '/admin/submissions',
        permission: 'ACADEMICS_MANAGE',
        description: 'Review submitted assignment versions.',
        icon: 'document',
      },
      {
        label: 'Assessments',
        href: '/admin/assessments',
        permission: 'ACADEMICS_MANAGE',
        description: 'Quizzes, assessments and question banks.',
        icon: 'check',
      },
      {
        label: 'Assessment Reviews',
        href: '/admin/attempts',
        permission: 'ACADEMICS_MANAGE',
        description: 'Review submitted assessment responses.',
        icon: 'check',
      },
      {
        label: 'Certificates',
        href: '/admin/certificates',
        permission: 'CERTIFICATES_MANAGE',
        description: 'Eligibility, issuance and certificate holds.',
        icon: 'award',
      },
    ],
  },
  {
    id: 'students',
    label: 'Students',
    href: '/admin/students',
    description: 'Student records, learning access and relationships.',
    destinations: [
      {
        label: 'Student Directory',
        href: '/admin/students',
        permission: 'STUDENTS_MANAGE',
        description: 'Enrollment, LMS access and Batch membership.',
        icon: 'students',
      },
      {
        label: 'Referrals',
        href: '/admin/referrals',
        permission: 'REFERRALS_VIEW',
        description: 'View existing student referral relationships.',
        icon: 'people',
      },
    ],
  },
  {
    id: 'people',
    label: 'People',
    href: '/admin/people',
    description: 'The people who make learning possible.',
    destinations: [
      {
        label: 'Instructors',
        href: '/admin/instructors',
        permission: 'BATCHES_MANAGE',
        description: 'Instructor identities and Batch assignments.',
        icon: 'people',
        primary: true,
      },
      {
        label: 'Users & Access',
        href: '/admin/users',
        permission: 'USERS_VIEW',
        description: 'Platform users, staff roles and governed access.',
        icon: 'shield',
        primary: true,
      },
    ],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    href: '/admin/inbox',
    description: 'A clear place for conversations and follow-up.',
    destinations: [
      {
        label: 'Support',
        href: '/admin/support',
        permission: 'SUPPORT_MANAGE',
        description: 'Help students and resolve support requests.',
        icon: 'inbox',
        primary: true,
      },
      {
        label: 'Discussions',
        href: '/admin/discussions',
        permission: 'DISCUSSIONS_MANAGE',
        description: 'Review course conversations and moderation.',
        icon: 'message',
        primary: true,
      },
      {
        label: 'Communications',
        href: '/admin/communications',
        permission: 'COMMUNICATIONS_MANAGE',
        description: 'Consent-aware audiences and message plans.',
        icon: 'send',
        primary: true,
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    description: 'Platform configuration and accountable administration.',
    destinations: [
      {
        label: 'Platform Settings',
        href: '/admin/settings',
        permission: 'SETTINGS_VIEW',
        description: 'Platform, learning, media and security readiness.',
        icon: 'settings',
      },
      {
        label: 'Audit Logs',
        href: '/admin/audit',
        permission: 'AUDIT_VIEW',
        description: 'Inspect the existing immutable activity history.',
        icon: 'document',
      },
    ],
  },
];
export function workspaceDestinations(
  id: AdminWorkspaceId,
  permissions: readonly AdminPermission[],
) {
  return adminWorkspaces
    .find((w) => w.id === id)!
    .destinations.filter((d) => permissions.includes(d.permission));
}
export function workspacePermissions(id: AdminWorkspaceId): AdminPermission[] {
  return [
    ...new Set(
      adminWorkspaces
        .find((w) => w.id === id)!
        .destinations.map((d) => d.permission),
    ),
  ];
}
/** Presentation grouping only. Services retain their own persisted authorization checks. */
export function visibleAdminNavigation(
  permissions: readonly AdminPermission[],
) {
  return adminWorkspaces.flatMap((w) => {
    const destinations = workspaceDestinations(w.id, permissions);
    if (w.id !== 'overview' && !destinations.length) return [];
    // Preserve access for referral-only and audit-only administrators without broadening a page guard.
    const href =
      w.id === 'students' ||
      w.id === 'settings' ||
      (w.id === 'marketplace' && !permissions.includes('MARKETPLACE_MANAGE'))
        ? destinations[0].href
        : w.href;
    return [{ ...w, href }];
  });
}
export function adminWorkspaceForPath(path: string): AdminWorkspaceId | null {
  if (!path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path))
    return null;
  const internal =
    path === '/'
      ? '/admin'
      : path === '/admin' || path.startsWith('/admin/')
        ? path
        : `/admin${path}`;
  if (internal === '/admin' || internal === '/admin/') return 'overview';
  const segment = internal.slice(7).split('/')[0];
  const groups: Record<string, AdminWorkspaceId> = {
    learning: 'learning',
    courses: 'learning',
    marketplace: 'marketplace',
    batches: 'learning',
    attendance: 'learning',
    assessments: 'learning',
    'question-banks': 'learning',
    attempts: 'learning',
    assignments: 'learning',
    submissions: 'learning',
    certificates: 'learning',
    students: 'students',
    referrals: 'students',
    people: 'people',
    instructors: 'people',
    users: 'people',
    inbox: 'inbox',
    discussions: 'inbox',
    support: 'inbox',
    communications: 'inbox',
    settings: 'settings',
    audit: 'settings',
  };
  return groups[segment] || null;
}
