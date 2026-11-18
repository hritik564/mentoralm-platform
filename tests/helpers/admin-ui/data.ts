import type { ItemDetail, Builder } from '@/components/admin/academic/types';
import type { AdminPermission } from '@/generated/prisma/client';
import type {
  BatchDetail,
  Overview,
  StudentList,
} from '@/components/admin/types';

export const permissions = [
  'STUDENTS_MANAGE',
  'BATCHES_MANAGE',
  'ACADEMICS_MANAGE',
  'ATTENDANCE_MANAGE',
  'CERTIFICATES_MANAGE',
  'DISCUSSIONS_MANAGE',
  'SUPPORT_MANAGE',
  'COMMUNICATIONS_MANAGE',
  'REFERRALS_VIEW',
  'USERS_VIEW',
  'AUDIT_VIEW',
  'SETTINGS_VIEW',
  'MARKETPLACE_MANAGE',
] as const satisfies readonly AdminPermission[];

export type Profile =
  | 'governance'
  | 'marketplace'
  | 'support'
  | 'audit'
  | 'referrals'
  | 'academics'
  | 'batches'
  | 'attendance'
  | 'certificates'
  | 'none';
export type Scenario = 'populated' | 'empty' | 'error' | 'loading';
export function accessFor(profile: Profile) {
  return {
    authority:
      profile === 'governance' ? ('GOVERNANCE' as const) : ('SCOPED' as const),
    permissions: (profile === 'governance'
      ? [...permissions]
      : profile === 'marketplace'
        ? ['MARKETPLACE_MANAGE']
        : profile === 'support'
          ? ['SUPPORT_MANAGE']
          : profile === 'audit'
            ? ['AUDIT_VIEW']
            : profile === 'referrals'
              ? ['REFERRALS_VIEW']
              : profile === 'academics'
                ? ['ACADEMICS_MANAGE']
                : profile === 'batches'
                  ? ['BATCHES_MANAGE']
                  : profile === 'attendance'
                    ? ['ATTENDANCE_MANAGE']
                    : profile === 'certificates'
                      ? ['CERTIFICATES_MANAGE']
                      : []) as AdminPermission[],
  };
}

const students = {
  page: 1,
  total: 2,
  rows: [
    {
      ref: 'fixture_student_1',
      studentId: 'ST-2026-000001',
      identity: {
        name: 'Taylor Example',
        email: 'taylor@example.test',
        phone: null,
        status: 'Active',
      },
      joined: '2026-11-02T09:00:00.000Z',
      batch: 'AI Foundations · November',
      access: true,
      source: 'student',
      enrollments: 1,
    },
    {
      ref: 'fixture_student_2',
      studentId: 'ST-2026-000002',
      identity: {
        name: 'Jordan Example',
        email: 'jordan@example.test',
        phone: null,
        status: 'Active',
      },
      joined: '2026-11-04T09:00:00.000Z',
      batch: '—',
      access: false,
      source: 'none',
      enrollments: 0,
    },
  ],
} satisfies StudentList;

const recording = (status: 'READY' | 'PUBLISHED' | 'PROCESSING') => ({
  revision: '00000000-0000-4000-8000-000000000001',
  status,
  title:
    status === 'READY'
      ? 'Ready recording class'
      : status === 'PUBLISHED'
        ? 'Published recording class'
        : 'Processing recording class',
  description: null,
  readyAt: status === 'PROCESSING' ? null : '2026-11-16T16:00:00.000Z',
  publishedAt: status === 'PUBLISHED' ? '2026-11-16T17:00:00.000Z' : null,
  fileName: 'class.mp4',
  mimeType: 'video/mp4',
  bytes: '1024',
  durationSeconds: 3600,
  cleanupPending: false,
});

const batchDetail = {
  ref: 'fixture_batch_1',
  code: 'AI-NOV-26',
  name: 'AI Foundations · November',
  status: 'ACTIVE',
  courseRef: 'fixture_course_1',
  programRef: 'fixture_program_1',
  scope: 'AI Foundations',
  starts: '2026-11-01T00:00:00.000Z',
  ends: '2026-11-30T23:59:59.000Z',
  access: true,
  counts: { students: 1, instructors: 1 },
  page: 1,
  total: 1,
  members: [
    {
      ref: 'fixture_student_1',
      name: 'Taylor Example',
      studentId: 'ST-2026-000001',
      status: 'ACTIVE',
      joined: '2026-11-02T09:00:00.000Z',
      left: null,
      effective: {
        enabled: true,
        source: 'AI Foundations · November Batch access',
      },
    },
  ],
  instructors: [
    {
      ref: 'fixture_instructor_1',
      name: 'Riley Example',
      assigned: '2026-11-01T09:00:00.000Z',
    },
  ],
  sessions: [
    {
      ref: 'fixture_session_1',
      title: 'Introduction to applied AI',
      status: 'SCHEDULED',
      starts: '2026-11-17T14:00:00.000Z',
      ends: '2026-11-17T15:00:00.000Z',
      courseRef: 'fixture_course_1',
      itemRef: null,
      itemTitle: null,
      instructorRef: 'fixture_instructor_1',
      instructorName: 'Riley Example',
      location: 'Online',
      externalTargetId: null,
      recording: null,
    },
    ...[
      {
        ref: 'fixture_session_2',
        title: 'Upcoming AI workshop',
        status: 'SCHEDULED' as const,
        starts: '2026-11-18T14:00:00.000Z',
        ends: '2026-11-18T15:00:00.000Z',
        recording: null,
      },
      {
        ref: 'fixture_session_3',
        title: 'Ready recording class',
        status: 'HELD' as const,
        starts: '2026-11-16T14:00:00.000Z',
        ends: '2026-11-16T15:00:00.000Z',
        recording: recording('READY'),
      },
      {
        ref: 'fixture_session_4',
        title: 'Published recording class',
        status: 'HELD' as const,
        starts: '2026-11-15T14:00:00.000Z',
        ends: '2026-11-15T15:00:00.000Z',
        recording: recording('PUBLISHED'),
      },
      {
        ref: 'fixture_session_5',
        title: 'Processing recording class',
        status: 'HELD' as const,
        starts: '2026-11-14T14:00:00.000Z',
        ends: '2026-11-14T15:00:00.000Z',
        recording: recording('PROCESSING'),
      },
    ].map((session) => ({
      ...session,
      courseRef: 'fixture_course_1',
      itemRef: 'fixture_live_item_1',
      itemTitle: 'Applied AI live class',
      instructorRef: 'fixture_instructor_1',
      instructorName: 'Riley Example',
      location: 'Online',
      externalTargetId: null,
    })),
  ],
} satisfies BatchDetail;

const overview = {
  metrics: {
    students: 2,
    enabled: 1,
    batches: 1,
    enrollments: 1,
    courses: 2,
    support: 2,
    sessions: 2,
    recordings: 1,
  },
  events: [
    { action: 'Course saved', at: '2026-11-17T08:10:00.000Z' },
    { action: 'Batch saved', at: '2026-11-17T07:45:00.000Z' },
  ],
  readyRecordings: 1,
  todaySessions: {
    date: '2026-11-17',
    timeZone: 'UTC',
    rows: [
      {
        ref: 'fixture_session_1',
        title: 'Introduction to applied AI',
        startsAt: '2026-11-17T14:00:00.000Z',
        endsAt: '2026-11-17T15:00:00.000Z',
        status: 'SCHEDULED',
        batchRef: 'fixture_batch_1',
        batchName: 'AI Foundations · November',
      },
    ],
  },
  learningCourses: [
    {
      courseRef: 'fixture_course_1',
      title: 'AI Foundations',
      program: 'Career Development',
      published: true,
      enrollments: 1,
    },
    {
      courseRef: 'fixture_course_2',
      title: 'Practical AI Workflows',
      program: 'Independent',
      published: false,
      enrollments: 0,
    },
  ],
} satisfies Overview;

const courseDetail = {
  ref: 'fixture_course_1',
  title: 'AI Foundations',
  description: 'Build practical skills with guided learning and live classes.',
  programRef: 'fixture_program_1',
  thumbnailPath: '/images/campus.webp',
  thumbnailAlt: 'Campus',
  publicPath: '/#programs',
  published: true,
  academicCompletionEnabled: true,
  certificateEnabled: true,
  requiredAttendancePercent: 75,
  sections: [
    {
      ref: 'fixture_section_1',
      title: 'Getting started',
      description: 'Learn, practise and apply.',
      published: true,
      position: 1,
      items: [
        ['fixture_assignment_1', 'Practical AI assignment', 'ASSIGNMENT'],
        ['fixture_assessment_1', 'AI knowledge assessment', 'ASSESSMENT'],
        ['fixture_resource_1', 'AI reference guide', 'RESOURCE'],
        ['fixture_live_item_1', 'Applied AI live class', 'LIVE_SESSION'],
      ].map(([ref, title, type], index) => ({
        ref,
        title,
        type: type as 'ASSIGNMENT' | 'ASSESSMENT' | 'RESOURCE' | 'LIVE_SESSION',
        required: true,
        published: true,
        position: index + 1,
        format: null,
        occurrences: type === 'LIVE_SESSION' ? 4 : 0,
      })),
    },
  ],
} satisfies Builder;

export function responseFor(
  pathname: string,
  search: URLSearchParams,
  profile: Profile,
  scenario: Scenario,
): unknown {
  const empty = scenario === 'empty';
  if (pathname === '/api/admin/overview') {
    if (profile === 'support')
      return { metrics: { support: empty ? 0 : 2 }, events: [] };
    if (profile === 'academics')
      return {
        metrics: {
          courses: empty ? 0 : overview.metrics.courses,
          enrollments: empty ? 0 : 1,
        },
        events: [],
        learningCourses: empty ? [] : overview.learningCourses,
      };
    if (profile === 'batches')
      return {
        metrics: {
          batches: empty ? 0 : 1,
          sessions: empty ? 0 : 2,
          recordings: empty ? 0 : 1,
        },
        events: [],
        readyRecordings: empty ? 0 : 1,
        todaySessions: {
          ...overview.todaySessions,
          rows: empty ? [] : overview.todaySessions.rows,
        },
      };
    if (profile !== 'governance') return { metrics: {}, events: [] };
    if (empty)
      return {
        ...overview,
        metrics: Object.fromEntries(
          Object.keys(overview.metrics).map((key) => [key, 0]),
        ),
        events: [],
        learningCourses: [],
        readyRecordings: 0,
        todaySessions: { ...overview.todaySessions, rows: [] },
      };
    return overview;
  }
  if (pathname === '/api/admin/operations/overview') {
    if (profile === 'support') return { openSupport: empty ? 0 : 2 };
    if (profile === 'academics')
      return { pendingAssignments: empty ? 0 : 3, pendingText: empty ? 0 : 1 };
    if (profile === 'attendance') return { heldWithoutRecords: empty ? 0 : 1 };
    if (profile === 'certificates')
      return { suspendedCertificates: empty ? 0 : 1 };
    if (profile !== 'governance') return {};
    return {
      pendingAssignments: empty ? 0 : 3,
      pendingText: empty ? 0 : 1,
      openSupport: empty ? 0 : 2,
      heldWithoutRecords: 0,
      suspendedCertificates: 0,
      deliveries: [],
    };
  }
  if (pathname === '/api/admin/students') {
    if (empty) return { page: 1, total: 0, rows: [] };
    const q = (search.get('q') || '').toLowerCase();
    const access = search.get('access');
    const rows = students.rows.filter(
      (student) =>
        (!q ||
          `${student.identity.name} ${student.identity.email} ${student.studentId}`
            .toLowerCase()
            .includes(q)) &&
        (!access || student.access === (access === 'enabled')),
    );
    return { ...students, rows, total: rows.length };
  }
  if (pathname === '/api/admin/batches/fixture_batch_1') {
    if (empty)
      return {
        ...batchDetail,
        counts: { students: 0, instructors: 0 },
        total: 0,
        members: [],
        instructors: [],
        sessions: [],
      } satisfies BatchDetail;
    return batchDetail;
  }
  if (pathname === '/api/admin/batches')
    return {
      page: 1,
      total: empty ? 0 : 1,
      rows: empty
        ? []
        : [
            {
              ref: 'fixture_batch_1',
              name: 'AI Foundations · November',
              code: 'AI-NOV-26',
              status: 'ACTIVE',
              scope: 'AI Foundations',
              starts: '2026-11-01T00:00:00.000Z',
              students: 1,
              instructors: 1,
              access: true,
            },
          ],
    };
  if (pathname === '/api/admin/academic/courses')
    return {
      page: 1,
      total: empty ? 0 : 2,
      rows: empty
        ? []
        : overview.learningCourses.map((course) => ({
            ref: course.courseRef,
            title: course.title,
            program: course.program || 'Independent',
            published: course.published,
            sections: 2,
            enrollments: course.enrollments,
          })),
    };
  if (pathname === '/api/admin/academic/courses/fixture_course_1')
    return empty ? { ...courseDetail, sections: [] } : courseDetail;
  if (
    pathname ===
    '/api/admin/academic/courses/fixture_course_1/sections/fixture_section_1/items/fixture_resource_1'
  )
    return {
      ref: 'fixture_resource_1',
      title: 'AI reference guide',
      type: 'RESOURCE',
      required: true,
      published: true,
      lesson: null,
      resource: {
        description: 'Guided reference',
        downloadAllowed: true,
        fileName: 'guide.pdf',
        mimeType: 'application/pdf',
        attached: false,
      },
      activity: null,
      assignment: null,
      sessions: [],
      externalTargets: [],
      mediaAvailable: false,
    } satisfies ItemDetail;
  if (pathname === '/api/admin/academic/live-batches') {
    if (search.get('course') !== 'fixture_course_1')
      throw Error('Course batch fixture requires the selected Course.');
    return empty ? [] : [{ ref: 'fixture_batch_1', name: batchDetail.name }];
  }
  if (
    [
      '/api/admin/operations/attendance',
      '/api/admin/operations/submissions',
      '/api/admin/operations/attempts',
      '/api/admin/operations/certificates',
    ].includes(pathname)
  )
    return { page: Number(search.get('page') || 1), total: 0, rows: [] };
  if (pathname === '/api/admin/academic/programs')
    return {
      page: 1,
      total: empty ? 0 : 1,
      rows: empty
        ? []
        : [
            {
              ref: 'fixture_program_1',
              title: 'Career Development',
              courses: 1,
            },
          ],
    };
  if (pathname === '/api/admin/governance/settings')
    return {
      groups: [
        {
          name: 'Platform',
          rows: [
            ['Website', 'Configured'],
            ['Admin Console', 'Configured'],
          ],
        },
        {
          name: 'Learning',
          rows: [
            ['Live classes', 'Not configured'],
            ['Recordings', 'Not configured'],
          ],
        },
        {
          name: 'Security',
          rows: [
            ['Authorization', 'Persisted Admin permissions'],
            ['Audit history', 'Immutable'],
          ],
        },
      ],
    };
  if (pathname === '/api/admin/governance/audit')
    return {
      page: 1,
      total: empty ? 0 : 1,
      filters: {
        actions: [{ value: 'CourseSaved', label: 'Course saved' }],
        categories: ['Academic'],
        targets: ['Course'],
      },
      rows: empty
        ? []
        : [
            {
              ref: 'fixture_audit_1',
              at: '2026-11-17T08:10:00.000Z',
              actorRef: 'fixture_actor_1',
              actor: 'Morgan Test',
              action: 'Course saved',
              category: 'Academic',
              target: 'Course',
              targetDescription: 'AI Foundations',
              summary: ['Published'],
            },
          ],
    };
  if (
    [
      '/api/admin/governance/users',
      '/api/admin/governance/instructors',
    ].includes(pathname)
  )
    return {
      page: 1,
      total: empty ? 0 : 1,
      rows: empty
        ? []
        : [
            {
              ref: 'fixture_user_1',
              name: 'Taylor Example',
              email: 'taylor@example.test',
              studentId: 'ST-2026-000001',
              primaryRole: 'STUDENT',
              additionalRoles: [],
              authority: null,
              lms: 'Enabled',
              enrollments: 1,
              memberships: 1,
              status: 'Active',
              teachingEligible: false,
              teaching: [],
            },
          ],
    };
  if (pathname.startsWith('/api/admin/choices/')) {
    const choice = pathname.slice('/api/admin/choices/'.length);
    if (choice === 'programs')
      return empty
        ? []
        : [{ ref: 'fixture_program_1', label: 'Career Development' }];
    if (choice === 'courses')
      return empty
        ? []
        : [{ ref: 'fixture_course_1', label: 'AI Foundations' }];
    if (choice === 'batches')
      return empty
        ? []
        : [{ ref: 'fixture_batch_1', label: 'AI Foundations · November' }];
    if (choice === 'items') {
      if (search.get('course') !== 'fixture_course_1')
        throw Error('Session item choices require the selected Course.');
      return empty
        ? []
        : [{ ref: 'fixture_live_item_1', label: 'Applied AI live class' }];
    }
    if (choice === 'instructors') return [];
  }
  // An explicit failure is safer than a permissive catch-all fake payload.
  throw Error(`Unexpected offline UI API path: ${pathname}`);
}
