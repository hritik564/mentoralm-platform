import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminWorkspaces,
  visibleAdminNavigation,
  workspaceDestinations,
  workspacePermissions,
  adminWorkspaceForPath,
} from '../src/lib/admin/navigation';
import {
  adminPermissions,
  adminPathPermission,
} from '../src/lib/admin/permissions';
import {
  adminHref,
  adminDestination,
  domainRoute,
} from '../src/lib/platform/domains';

test('Admin navigation has exactly six workflow groups with permission-filtered destinations', () => {
  assert.deepEqual(
    adminWorkspaces.map((w) => w.label),
    ['Overview', 'Learning', 'Students', 'People', 'Inbox', 'Settings'],
  );
  assert.equal(visibleAdminNavigation(adminPermissions).length, 6);
  assert.deepEqual(
    visibleAdminNavigation([]).map((w) => w.label),
    ['Overview'],
  );
  assert.deepEqual(
    visibleAdminNavigation(['SUPPORT_MANAGE']).map((w) => w.label),
    ['Overview', 'Inbox'],
  );
  assert.deepEqual(
    workspaceDestinations('inbox', ['SUPPORT_MANAGE']).map((d) => d.href),
    ['/admin/support'],
  );
  assert.deepEqual(
    workspaceDestinations('people', ['USERS_VIEW']).map((d) => d.href),
    ['/admin/users'],
  );
  assert.deepEqual(workspacePermissions('learning').sort(), [
    'ACADEMICS_MANAGE',
    'ATTENDANCE_MANAGE',
    'BATCHES_MANAGE',
    'CERTIFICATES_MANAGE',
  ]);
});
test('Audit-only and referral-only administrators retain their existing child access', () => {
  const audit = visibleAdminNavigation(['AUDIT_VIEW']);
  assert.deepEqual(
    audit.map((w) => [w.label, w.href]),
    [
      ['Overview', '/admin'],
      ['Settings', '/admin/audit'],
    ],
  );
  const referrals = visibleAdminNavigation(['REFERRALS_VIEW']);
  assert.deepEqual(
    referrals.map((w) => [w.label, w.href]),
    [
      ['Overview', '/admin'],
      ['Students', '/admin/referrals'],
    ],
  );
  assert.equal(adminPathPermission('/admin/settings'), 'SETTINGS_VIEW');
  assert.equal(adminPathPermission('/admin/students'), 'STUDENTS_MANAGE');
  assert.equal(adminPathPermission('/admin/users'), 'USERS_VIEW');
});
test('Every legacy Admin area and descendant maps to one active workflow on both hosts', () => {
  for (const [group, areas] of Object.entries({
    learning: [
      'learning',
      'courses',
      'batches',
      'attendance',
      'assessments',
      'question-banks',
      'attempts',
      'assignments',
      'submissions',
      'certificates',
    ],
    students: ['students', 'referrals'],
    people: ['people', 'instructors', 'users'],
    inbox: ['inbox', 'discussions', 'support', 'communications'],
    settings: ['settings', 'audit'],
  })) {
    for (const area of areas)
      for (const suffix of ['', '/existing_ref'])
        for (const prefix of ['', '/admin'])
          assert.equal(
            adminWorkspaceForPath(`${prefix}/${area}${suffix}`),
            group,
          );
  }
  assert.equal(adminWorkspaceForPath('/'), 'overview');
  assert.equal(adminWorkspaceForPath('/admin'), 'overview');
  for (const bad of [
    'https://evil.test',
    '//evil.test/admin',
    '/admin/unknown',
    '/administrator',
    '/admin?x=1',
    '/admin\\students',
  ])
    assert.equal(adminWorkspaceForPath(bad), null);
});
test('New workspace links preserve the closed Admin redirect/host boundary', () => {
  const previous = process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
  const website = process.env.NEXT_PUBLIC_SITE_URL;
  const lms = process.env.NEXT_PUBLIC_LMS_ORIGIN;
  try {
    delete process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
    for (const path of [
      '/admin/learning',
      '/admin/learning/classes',
      '/admin/learning/recordings',
      '/admin/people',
      '/admin/inbox',
    ]) {
      assert.equal(adminHref(path), path);
      assert.equal(adminDestination(path), path);
      assert.deepEqual(domainRoute('admin.mentoralm.com', path.slice(6)), {
        kind: 'rewrite',
        path,
      });
    }
    for (const path of [
      '/admin/learning/unknown',
      '/admin/people/anything',
      '/admin/inbox/anything',
      '/admin/learning/../../users',
      'https://evil.test/admin',
      '//evil.test/admin',
      '/admin/inbox?redirect_url=https://evil.test',
    ]) {
      assert.throws(() => adminHref(path));
      assert.equal(adminDestination(path), '/admin');
    }
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mentoralm.com';
    process.env.NEXT_PUBLIC_LMS_ORIGIN = 'https://students.mentoralm.com';
    process.env.NEXT_PUBLIC_ADMIN_ORIGIN = 'https://admin.mentoralm.com';
    assert.equal(
      adminHref('/admin/learning/classes'),
      'https://admin.mentoralm.com/learning/classes',
    );
    assert.deepEqual(domainRoute('mentoralm.com', '/admin/people'), {
      kind: 'redirect',
      path: 'https://admin.mentoralm.com/people',
    });
  } finally {
    for (const [key, value] of Object.entries({
      NEXT_PUBLIC_ADMIN_ORIGIN: previous,
      NEXT_PUBLIC_SITE_URL: website,
      NEXT_PUBLIC_LMS_ORIGIN: lms,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
