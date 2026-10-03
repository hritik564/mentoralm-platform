import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isolatedDatabase } from './helpers/d4-database';
import {
  adminPermissions,
  legacyAdminPermissions,
  operationalPermissions,
  adminWritePermission,
} from '../src/lib/admin/permissions';
import {
  adminCapabilities,
  requireAdminPermission,
  requireGovernance,
} from '../src/lib/auth/admin-policy';
import { GovernanceRepository } from '../src/lib/admin/governance/read';
import {
  accessState,
  protectGovernor,
  governanceTransaction,
} from '../src/lib/admin/governance/access';
import { bootstrapGovernance } from '../scripts/admin-owner/governance-bootstrap';
import { AdminRepository } from '../src/lib/admin/repository';
import { AdminOperationalRepository } from '../src/lib/admin/operational/read';
import { AcademicAuthoring } from '../src/lib/admin/academic/authoring';
import { AcademicStaff } from '../src/lib/lms/academic-staff';
import { LmsAccessAdmin } from '../src/lib/lms/access-admin';
import { BatchCommunications } from '../src/lib/lms/communications';
import { AdminRecordings } from '../src/lib/admin/recordings';
import { academicFixture } from './helpers/l3-fixtures';
import { studentSnapshot } from '../scripts/admin-owner/snapshot';
import { seedFixtures, resetFixtures } from '../scripts/lms-owner/fixtures';
import {
  safeAuditSummary,
  safeAuditAction,
} from '../src/lib/admin/governance/audit-projection';
import {
  adminDestination,
  adminHref,
  domainRoute,
} from '../src/lib/platform/domains';
const directory = {
  search: async () => [],
  lookup: async (ids: string[]) =>
    new Map(
      ids.map((id) => [
        id,
        {
          name: 'Test identity',
          email: 'identity@example.test',
          phone: null,
          status: 'Active' as const,
        },
      ]),
    ),
};
const common = { confirmation: true, reason: 'Authorized test operation' };
const migration = '20261003010000_admin_a4_governance';

test('A4 populated upgrade preserves history and backfills exactly legacy operational capabilities', async () => {
  const f = await isolatedDatabase(
    undefined,
    '20261003000000_admin_a3_operations',
  );
  try {
    const db = f.db,
      primary = await db.user.create({
        data: { clerkUserId: 'legacy-primary', role: 'ADMIN' },
      }),
      student = await db.user.create({
        data: { clerkUserId: 'legacy-student', lmsAccessOverride: 'ENABLED' },
      }),
      normal = await db.user.create({ data: { clerkUserId: 'normal' } });
    await db.userRoleAssignment.create({
      data: { userId: student.id, role: 'ADMIN' },
    });
    await db.academicAudit.create({
      data: {
        actorId: primary.id,
        action: 'HistoricalEvent',
        targetId: normal.id,
        details: { body: 'Private historical payload' },
      },
    });
    const history = await studentSnapshot(db, student.id),
      audit = await db.academicAudit.findMany();
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
    );
    for (const u of [primary, student]) {
      const p = await db.adminAuthorization.findUniqueOrThrow({
        where: { userId: u.id },
      });
      assert.equal(p.authority, 'SCOPED');
      assert.deepEqual(p.permissions, legacyAdminPermissions);
      assert.match(p.revision, /^[a-f0-9-]{36}$/);
    }
    assert.equal(await db.adminAuthorization.count(), 2);
    assert.deepEqual(await studentSnapshot(db, student.id), history);
    assert.deepEqual(await db.academicAudit.findMany(), audit);
    assert.ok(
      !/^\s*(DROP|DELETE|UPDATE|TRUNCATE)\s/im.test(
        readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'),
      ),
    );
  } finally {
    await f.cleanup();
  }
});
test('A4 authorization, governance, sanitized projections, bulk safety and immutable audit', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db;
  try {
    const governor = await db.user.create({
        data: {
          clerkUserId: 'gov',
          role: 'STUDENT',
          roleAssignments: { create: { role: 'ADMIN' } },
          adminAuthorization: { create: { authority: 'GOVERNANCE' } },
        },
      }),
      scoped = await db.user.create({
        data: {
          clerkUserId: 'scoped',
          role: 'ADMIN',
          adminAuthorization: { create: { permissions: ['SUPPORT_MANAGE'] } },
        },
      }),
      noPolicy = await db.user.create({
        data: { clerkUserId: 'no-policy', role: 'ADMIN' },
      }),
      student = await db.user.create({
        data: { clerkUserId: 'student', lmsAccessOverride: 'ENABLED' },
      }),
      orphan = await db.user.create({
        data: {
          clerkUserId: 'policy-without-role',
          adminAuthorization: { create: { authority: 'GOVERNANCE' } },
        },
      });
    const gov = new GovernanceRepository(db, governor.id, directory),
      limited = new GovernanceRepository(db, scoped.id, directory),
      ops = new AdminOperationalRepository(db, scoped.id, directory, f.schema),
      r = new AdminRepository(db, scoped.id, directory),
      x = await academicFixture(db, student.id, 'a4');
    await t.test(
      'effective ADMIN mandatory even with GOVERNANCE row; missing/empty policies default deny',
      async () => {
        await assert.rejects(adminCapabilities(db, orphan.id), {
          code: 'FORBIDDEN',
        });
        assert.deepEqual(
          (await adminCapabilities(db, noPolicy.id)).permissions,
          [],
        );
        await assert.rejects(
          requireAdminPermission(db, noPolicy.id, 'STUDENTS_MANAGE'),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(
          new GovernanceRepository(db, student.id, directory).role(
            student.id,
            {},
          ),
        );
        assert.deepEqual(
          (await adminCapabilities(db, governor.id)).permissions,
          [...adminPermissions],
        );
        assert.ok(
          (await studentSnapshot(db, governor.id)).primaryRole === 'STUDENT',
        );
      },
    );
    await t.test(
      'Support-only Overview and sidebar data omit unrelated domains; every operational read guarded',
      async () => {
        assert.deepEqual(Object.keys((await r.overview()).metrics), [
          'support',
        ]);
        assert.deepEqual((await r.overview()).events, []);
        assert.deepEqual(Object.keys(await ops.overview()), ['openSupport']);
        for (const area of Object.keys(
          operationalPermissions,
        ) as (keyof typeof operationalPermissions)[]) {
          if (area === 'support') assert.equal((await ops.list(area)).total, 0);
          else await assert.rejects(ops.list(area), { code: 'FORBIDDEN' });
        }
        for (const work of [
          () => r.students(),
          () => r.student(student.id),
          () => r.batches(),
          () => r.choices('courses'),
          () => limited.users(),
          () => limited.audit(),
          () => limited.settings(),
          () => new AcademicAuthoring(db, scoped.id).authorize(),
          () =>
            new AdminRecordings(db, scoped.id).reconcile(
              x.session.id,
              randomUUID(),
            ),
        ])
          await assert.rejects(work, { code: 'FORBIDDEN' });
      },
    );
    await t.test(
      'shared LMS Admin branches never bypass permission policy',
      async () => {
        await assert.rejects(
          new LmsAccessAdmin(db, scoped.id).change({
            kind: 'STUDENT_OVERRIDE',
            userId: student.id,
            value: 'DISABLED',
          }),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(
          new AcademicStaff(db, scoped.id).reconcile(student.id, x.course.id),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(
          new AcademicStaff(db, scoped.id).attendance(
            x.session.id,
            x.membership.id,
            'PRESENT',
          ),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(
          new BatchCommunications(db, scoped.id).audience(
            x.batch.id,
            'EMAIL',
            'MARKETING',
          ),
          { code: 'FORBIDDEN' },
        );
      },
    );
    await t.test(
      'scoped self-promotion, forged actor and mass assignment rejected',
      async () => {
        const { state } = await accessState(db, scoped.id);
        await assert.rejects(
          limited.role(student.id, {
            ...common,
            role: 'ADMIN',
            operation: 'grant',
            expectedState: state,
          }),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(
          gov.role(student.id, {
            ...common,
            role: 'ADMIN',
            operation: 'grant',
            expectedState: (await accessState(db, student.id)).state,
            actorId: governor.id,
          }),
          { code: 'INVALID_INPUT' },
        );
        await assert.rejects(
          gov.policy(scoped.id, {
            ...common,
            authority: 'GOVERNANCE',
            permissions: [],
            expectedRevision: 'not-a-revision',
          }),
          { code: 'INVALID_INPUT' },
        );
      },
    );
    await t.test(
      'new ADMIN atomically scoped empty; stale state conflicts; Instructor label preserves teaching FK',
      async () => {
        const before = await studentSnapshot(db, student.id),
          oldState = (await accessState(db, student.id)).state;
        await gov.role(student.id, {
          ...common,
          role: 'ADMIN',
          operation: 'grant',
          expectedState: oldState,
        });
        assert.deepEqual(
          (await adminCapabilities(db, student.id)).permissions,
          [],
        );
        await assert.rejects(
          gov.role(student.id, {
            ...common,
            role: 'INSTRUCTOR',
            operation: 'grant',
            expectedState: oldState,
          }),
          { code: 'CONFLICT' },
        );
        await gov.role(student.id, {
          ...common,
          role: 'INSTRUCTOR',
          operation: 'grant',
          expectedState: (await accessState(db, student.id)).state,
        });
        await assert.rejects(
          db.batchInstructor.create({
            data: { batchId: x.batch.id, instructorId: student.id },
          }),
        );
        assert.deepEqual(await studentSnapshot(db, student.id), before);
      },
    );
    await t.test(
      'policy revisions, immediate revoke and privilege-free regrant',
      async () => {
        const p = await db.adminAuthorization.findUniqueOrThrow({
          where: { userId: student.id },
        });
        await gov.policy(student.id, {
          ...common,
          authority: 'SCOPED',
          permissions: ['STUDENTS_MANAGE'],
          expectedRevision: p.revision,
        });
        await requireAdminPermission(db, student.id, 'STUDENTS_MANAGE');
        await assert.rejects(
          gov.policy(student.id, {
            ...common,
            authority: 'GOVERNANCE',
            permissions: [],
            expectedRevision: p.revision,
          }),
          { code: 'CONFLICT' },
        );
        await gov.role(student.id, {
          ...common,
          role: 'ADMIN',
          operation: 'revoke',
          expectedState: (await accessState(db, student.id)).state,
        });
        assert.equal(
          await db.adminAuthorization.findUnique({
            where: { userId: student.id },
          }),
          null,
        );
        await assert.rejects(
          requireAdminPermission(db, student.id, 'STUDENTS_MANAGE'),
          { code: 'FORBIDDEN' },
        );
        await gov.role(student.id, {
          ...common,
          role: 'ADMIN',
          operation: 'grant',
          expectedState: (await accessState(db, student.id)).state,
        });
        assert.deepEqual(
          (await adminCapabilities(db, student.id)).permissions,
          [],
        );
      },
    );
    await t.test(
      'blocked self-demotion and final unique governor protection',
      async () => {
        const p = await db.adminAuthorization.findUniqueOrThrow({
          where: { userId: governor.id },
        });
        await assert.rejects(
          gov.policy(governor.id, {
            ...common,
            authority: 'SCOPED',
            permissions: [],
            expectedRevision: p.revision,
          }),
          { code: 'CONFLICT' },
        );
        await assert.rejects(
          gov.role(governor.id, {
            ...common,
            role: 'ADMIN',
            operation: 'revoke',
            expectedState: (await accessState(db, governor.id)).state,
          }),
          { code: 'CONFLICT' },
        );
        await assert.rejects(
          governanceTransaction(db, (tx) =>
            protectGovernor(tx, 'trusted-other', governor.id),
          ),
          { code: 'CONFLICT' },
        );
        // A GOVERNANCE policy without ADMIN is not counted as a governor.
        await assert.rejects(requireGovernance(db, orphan.id), {
          code: 'FORBIDDEN',
        });
      },
    );
    await t.test(
      'audit failure rolls back role, policy and revision changes',
      async () => {
        const before = await accessState(db, noPolicy.id);
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${f.schema}".reject_a4_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER a4_insert_failure BEFORE INSERT ON "${f.schema}"."AcademicAudit" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".reject_a4_insert()`,
        );
        try {
          await assert.rejects(
            gov.role(noPolicy.id, {
              ...common,
              role: 'INSTRUCTOR',
              operation: 'grant',
              expectedState: before.state,
            }),
          );
          assert.equal(
            (await accessState(db, noPolicy.id)).state,
            before.state,
          );
        } finally {
          await db.$executeRawUnsafe(
            `DROP TRIGGER a4_insert_failure ON "${f.schema}"."AcademicAudit"`,
          );
        }
      },
    );
    await t.test(
      'bounded bulk validates each target, reports failures and audits outcomes',
      async () => {
        const result = await gov.bulk({
          users: [student.id, 'missing'],
          value: 'DISABLED',
          ...common,
        });
        assert.deepEqual(
          result.results.map((r) => r.saved),
          [true, false],
        );
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: student.id } }))
            .lmsAccessOverride,
          'DISABLED',
        );
        assert.equal(
          await db.academicAudit.count({
            where: { action: 'BulkLmsAccessFailed' },
          }),
          1,
        );
        await assert.rejects(
          gov.bulk({
            users: Array.from({ length: 51 }, () => randomUUID()),
            value: 'ENABLED',
            ...common,
          }),
          { code: 'INVALID_INPUT' },
        );
        await assert.rejects(
          gov.bulk({
            users: [student.id, student.id],
            value: 'ENABLED',
            ...common,
          }),
          { code: 'INVALID_INPUT' },
        );
      },
    );
    await t.test(
      'audit explorer safe registry; unknown envelope only; settings contain no secrets',
      async () => {
        const secret = 'private-secret-should-never-appear';
        await db.academicAudit.create({
          data: {
            actorId: governor.id,
            action: secret,
            targetId: secret,
            details: { body: secret, assetRef: secret, url: secret },
          },
        });
        assert.equal(
          safeAuditAction(secret),
          'Unrecognized historical operation',
        );
        assert.deepEqual(
          safeAuditSummary(secret, { beforeStatus: 'OPEN' }),
          [],
        );
        assert.equal(
          (
            await gov.audit({
              category: 'Support',
              action: 'AdditionalRoleChanged',
            })
          ).total,
          0,
        );
        const audit = await gov.audit({ category: 'Unknown' }),
          serialized = JSON.stringify(audit);
        assert.ok(!serialized.includes(secret));
        assert.equal(audit.rows[0].target, null);
        assert.equal(audit.rows[0].targetDescription, null);
        await db.academicAudit.create({
          data: {
            actorId: governor.id,
            action: 'AdditionalRoleChanged',
            targetId: student.id,
            details: { body: secret },
          },
        });
        const known = await gov.audit({ action: 'AdditionalRoleChanged' });
        assert.equal(known.rows[0].target, 'User');
        assert.equal(
          known.rows[0].targetDescription,
          `Test identity · ${(await db.user.findUniqueOrThrow({ where: { id: student.id } })).studentId}`,
        );
        assert.ok(!JSON.stringify(known).includes(student.id));
        assert.ok(!JSON.stringify(known).includes(secret));
        assert.ok(!serialized.includes(governor.clerkUserId));
        assert.ok(!serialized.includes(governor.id));
        assert.deepEqual(
          safeAuditSummary('SupportAdminAction', {
            beforeStatus: 'OPEN',
            afterStatus: 'CLOSED',
            body: secret,
          }),
          ['before Status: OPEN', 'after Status: CLOSED'],
        );
        const settings = JSON.stringify(await gov.settings());
        for (const key of [
          'CLERK_SECRET_KEY',
          'DATABASE_URL',
          'LMS_FILES_ROOT',
        ])
          if (process.env[key])
            assert.ok(!settings.includes(process.env[key]!));
      },
    );
    await t.test(
      'database permission arrays reject NULL, duplicates, multidimensional and governance permissions',
      async () => {
        for (const expr of [
          `ARRAY['SUPPORT_MANAGE','SUPPORT_MANAGE']::"${f.schema}"."AdminPermission"[]`,
          `ARRAY[NULL]::"${f.schema}"."AdminPermission"[]`,
          `ARRAY[['SUPPORT_MANAGE']]::"${f.schema}"."AdminPermission"[]`,
        ])
          await assert.rejects(
            db.$executeRawUnsafe(
              `UPDATE "${f.schema}"."AdminAuthorization" SET permissions=${expr} WHERE "userId"='${scoped.id}'`,
            ),
          );
        await assert.rejects(
          db.adminAuthorization.update({
            where: { userId: governor.id },
            data: { permissions: ['USERS_VIEW'] },
          }),
        );
      },
    );
    await t.test(
      'AcademicAudit UPDATE DELETE TRUNCATE rejected; history preserved; insert allowed',
      async () => {
        const a = await db.academicAudit.findFirstOrThrow(),
          count = await db.academicAudit.count();
        await assert.rejects(
          db.academicAudit.update({
            where: { id: a.id },
            data: { action: 'tampered' },
          }),
        );
        await assert.rejects(db.academicAudit.delete({ where: { id: a.id } }));
        await assert.rejects(
          db.$executeRawUnsafe(`TRUNCATE "${f.schema}"."AcademicAudit"`),
        );
        assert.equal(await db.academicAudit.count(), count);
        assert.deepEqual(
          await db.academicAudit.findUnique({ where: { id: a.id } }),
          a,
        );
      },
    );
  } finally {
    await f.cleanup();
  }
});
test('A4 concurrent governors cannot mutually remove/demote and lock out platform', async () => {
  const f = await isolatedDatabase();
  try {
    const db = f.db,
      a = await db.user.create({
        data: {
          clerkUserId: 'g1',
          roleAssignments: { create: { role: 'ADMIN' } },
          adminAuthorization: { create: { authority: 'GOVERNANCE' } },
        },
      }),
      b = await db.user.create({
        data: {
          clerkUserId: 'g2',
          roleAssignments: { create: { role: 'ADMIN' } },
          adminAuthorization: { create: { authority: 'GOVERNANCE' } },
        },
      });
    const [sa, sb] = await Promise.all([
        accessState(db, a.id),
        accessState(db, b.id),
      ]),
      results = await Promise.allSettled([
        new GovernanceRepository(db, a.id, directory).role(b.id, {
          ...common,
          role: 'ADMIN',
          operation: 'revoke',
          expectedState: sb.state,
        }),
        new GovernanceRepository(db, b.id, directory).policy(a.id, {
          ...common,
          authority: 'SCOPED',
          permissions: [],
          expectedRevision: sa.user.adminAuthorization!.revision,
        }),
      ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      await db.adminAuthorization.count({
        where: {
          authority: 'GOVERNANCE',
          user: {
            OR: [
              { role: 'ADMIN' },
              { roleAssignments: { some: { role: 'ADMIN' } } },
            ],
          },
        },
      }),
      1,
    );
  } finally {
    await f.cleanup();
  }
});
test('A4 owner bootstrap idempotence preserves Student digest; seed reset/reseed appends history', async () => {
  const f = await isolatedDatabase();
  try {
    const db = f.db,
      u = await db.user.create({
        data: {
          clerkUserId: 'owner-bootstrap',
          roleAssignments: { create: { role: 'ADMIN' } },
          adminAuthorization: {
            create: { permissions: legacyAdminPermissions },
          },
        },
      }),
      before = await studentSnapshot(db, u.id);
    assert.equal((await bootstrapGovernance(db, u.id)).changed, true);
    assert.equal((await bootstrapGovernance(db, u.id)).changed, false);
    assert.deepEqual(await studentSnapshot(db, u.id), before);
    assert.equal(
      await db.academicAudit.count({
        where: { action: 'LOCAL_GOVERNANCE_BOOTSTRAP' },
      }),
      2,
    );
    await seedFixtures(db, u.id, u.clerkUserId, 'test-private-key');
    await resetFixtures(db, u.id, u.clerkUserId);
    const afterReset = await db.academicAudit.count();
    await seedFixtures(db, u.id, u.clerkUserId, 'test-private-key');
    assert.ok((await db.academicAudit.count()) > afterReset);
    assert.equal(
      await db.academicAudit.count({
        where: { action: 'LOCAL_OWNER_SEED_RESET' },
      }),
      1,
    );
  } finally {
    await f.cleanup();
  }
});
test('A4 route allowlist and trusted action permission registry stay closed', () => {
  for (const p of [
    '/admin/users',
    '/admin/audit',
    '/admin/settings',
    '/admin/instructors',
  ]) {
    assert.equal(adminDestination(p), p);
    assert.equal(adminHref(p), p);
    assert.equal(domainRoute('admin.mentoralm.com', p.slice(6)).path, p);
  }
  assert.equal(adminDestination('/admin/users/../../evil'), '/admin');
  assert.equal(adminWritePermission('UntrustedAction'), undefined);
  const roots = [
    'src/lib/admin/academic/structure.ts',
    'src/lib/admin/academic/authoring.ts',
    'src/lib/admin/academic/media.ts',
    'src/lib/admin/operational/learning.ts',
    'src/lib/admin/operational/actions.ts',
    'src/lib/admin/operational/read.ts',
  ];
  for (const path of roots)
    for (const [, action] of readFileSync(path, 'utf8').matchAll(
      /(?:this\.write\(|\n\s+)['"]([A-Z][A-Za-z]+)['"]/g,
    ))
      if (
        /Saved$|Deleted$|Ordered$|^AcademicAsset|^SubmissionFile|^CertificatePolicy|^DiscussionLock|^SupportAdmin|^AcademicResponse/.test(
          action,
        )
      )
        assert.ok(adminWritePermission(action), `${path}: ${action}`);
});

test('A4 every scoped operational permission admits only its domain; Users/Audit/Settings are read-only', async () => {
  const f = await isolatedDatabase();
  try {
    const db = f.db,
      u = await db.user.create({
        data: {
          clerkUserId: 'permission-matrix',
          role: 'ADMIN',
          adminAuthorization: { create: {} },
        },
      }),
      ops = new AdminOperationalRepository(db, u.id, directory, f.schema),
      gov = new GovernanceRepository(db, u.id, directory);
    for (const [area, p] of Object.entries(operationalPermissions) as [
      keyof typeof operationalPermissions,
      (typeof operationalPermissions)[keyof typeof operationalPermissions],
    ][]) {
      await db.adminAuthorization.update({
        where: { userId: u.id },
        data: { permissions: [p] },
      });
      for (const [other, required] of Object.entries(
        operationalPermissions,
      ) as [keyof typeof operationalPermissions, typeof p][]) {
        if (required === p) await ops.list(other);
        else await assert.rejects(ops.list(other), { code: 'FORBIDDEN' });
      }
      assert.equal((await ops.list(area)).total, 0);
    }
    for (const [permission, read] of [
      ['USERS_VIEW', () => gov.users()],
      ['AUDIT_VIEW', () => gov.audit()],
      ['SETTINGS_VIEW', () => gov.settings()],
    ] as const) {
      await db.adminAuthorization.update({
        where: { userId: u.id },
        data: { permissions: [permission] },
      });
      await read();
      await assert.rejects(
        gov.role(u.id, {
          ...common,
          role: 'INSTRUCTOR',
          operation: 'grant',
          expectedState: (await accessState(db, u.id)).state,
        }),
        { code: 'FORBIDDEN' },
      );
    }
  } finally {
    await f.cleanup();
  }
});
test('A4 additional scoped ADMIN does not erase an assigned primary Instructor authority or broaden it', async () => {
  const f = await isolatedDatabase();
  try {
    const db = f.db,
      s = await db.user.create({
        data: {
          clerkUserId: 'coexisting-student',
          lmsAccessOverride: 'ENABLED',
        },
      }),
      i = await db.user.create({
        data: {
          clerkUserId: 'coexisting-instructor',
          role: 'INSTRUCTOR',
          roleAssignments: { create: { role: 'ADMIN' } },
          adminAuthorization: { create: {} },
        },
      }),
      x = await academicFixture(db, s.id, 'a4instructor');
    await db.batchInstructor.create({
      data: { batchId: x.batch.id, instructorId: i.id },
    });
    await new AcademicStaff(db, i.id).attendance(
      x.session.id,
      x.membership.id,
      'PRESENT',
    );
    await new AcademicStaff(db, i.id).reconcile(s.id, x.course.id, x.batch.id);
    await new BatchCommunications(db, i.id).audience(
      x.batch.id,
      'EMAIL',
      'OPERATIONAL',
    );
    await assert.rejects(
      new BatchCommunications(db, i.id).audience(
        x.batch.id,
        'EMAIL',
        'MARKETING',
      ),
      { code: 'FORBIDDEN' },
    );
    await assert.rejects(
      new AcademicStaff(db, i.id).attendance(
        x.session.id,
        x.membership.id,
        'ABSENT',
        { adminOnly: true, userId: s.id, reason: 'Admin route attempt' },
      ),
      { code: 'FORBIDDEN' },
    );
    const other = await db.batch.create({
      data: {
        code: 'A4-OTHER-INSTRUCTOR',
        name: 'Other Batch',
        courseId: x.course.id,
      },
    });
    await assert.rejects(
      new AcademicStaff(db, i.id).reconcile(s.id, x.course.id, other.id),
      { code: 'FORBIDDEN' },
    );
  } finally {
    await f.cleanup();
  }
});
test('A4 missing policy may be explicitly initialized scoped; locked identity cannot be promoted; two removals serialize', async () => {
  const f = await isolatedDatabase();
  try {
    const db = f.db,
      a = await db.user.create({
        data: {
          clerkUserId: 'safety-a',
          roleAssignments: { create: { role: 'ADMIN' } },
          adminAuthorization: { create: { authority: 'GOVERNANCE' } },
        },
      }),
      b = await db.user.create({
        data: {
          clerkUserId: 'safety-b',
          roleAssignments: { create: { role: 'ADMIN' } },
        },
      }),
      g = new GovernanceRepository(db, a.id, directory);
    await g.policy(b.id, {
      ...common,
      authority: 'SCOPED',
      permissions: ['AUDIT_VIEW'],
      expectedRevision: null,
    });
    const p = await db.adminAuthorization.findUniqueOrThrow({
      where: { userId: b.id },
    });
    const locked = {
      ...directory,
      lookup: async (ids: string[]) =>
        new Map(
          ids.map((id) => [
            id,
            {
              name: 'Locked',
              email: '',
              phone: null,
              status: 'Locked' as const,
            },
          ]),
        ),
    };
    await assert.rejects(
      new GovernanceRepository(db, a.id, locked).policy(b.id, {
        ...common,
        authority: 'GOVERNANCE',
        permissions: [],
        expectedRevision: p.revision,
      }),
      { code: 'CONFLICT' },
    );
    await g.policy(b.id, {
      ...common,
      authority: 'GOVERNANCE',
      permissions: [],
      expectedRevision: p.revision,
    });
    const [sa, sb] = await Promise.all([
      accessState(db, a.id),
      accessState(db, b.id),
    ]);
    const result = await Promise.allSettled([
      g.role(b.id, {
        ...common,
        role: 'ADMIN',
        operation: 'revoke',
        expectedState: sb.state,
      }),
      new GovernanceRepository(db, b.id, directory).role(a.id, {
        ...common,
        role: 'ADMIN',
        operation: 'revoke',
        expectedState: sa.state,
      }),
    ]);
    assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      await db.adminAuthorization.count({ where: { authority: 'GOVERNANCE' } }),
      1,
    );
  } finally {
    await f.cleanup();
  }
});

test('A4 recording provider result cannot bind after permission revocation; durable intent remains reconcilable', async () => {
  const f = await isolatedDatabase();
  try {
    const db = f.db,
      u = await db.user.create({
        data: {
          clerkUserId: 'recording-scoped',
          role: 'ADMIN',
          adminAuthorization: { create: { permissions: ['BATCHES_MANAGE'] } },
        },
      }),
      s = await db.user.create({
        data: {
          clerkUserId: 'recording-student',
          lmsAccessOverride: 'ENABLED',
        },
      }),
      x = await academicFixture(db, s.id, 'a4recording');
    const live = await db.learningItem.create({
      data: {
        sectionId: x.section.id,
        title: 'Recorded session',
        type: 'LIVE_SESSION',
        position: 99,
        published: true,
      },
    });
    await db.batchSession.update({
      where: { id: x.session.id },
      data: { itemId: live.id },
    });
    const store = {
      name: 'private-test-adapter',
      begin: async (revision: string) => {
        await db.adminAuthorization.update({
          where: { userId: u.id },
          data: { permissions: [] },
        });
        return { assetRef: `private/${revision}` };
      },
      inspect: async () => ({
        ready: false,
        failed: false,
        assetRef: 'private/test',
      }),
      remove: async () => {},
      deliver: async () => new Response('private'),
    };
    await assert.rejects(
      new AdminRecordings(db, u.id, store).change(x.session.id, {
        action: 'UPLOAD',
      }),
      { code: 'FORBIDDEN' },
    );
    const row = await db.batchSessionRecording.findUniqueOrThrow({
      where: { sessionId: x.session.id },
    });
    assert.equal(row.assetRef, null);
    assert.equal(row.status, 'UPLOADING');
    assert.equal(
      await db.academicAudit.count({
        where: { action: 'RecordingUploadRequested' },
      }),
      1,
    );
    assert.equal(
      await db.academicAudit.count({
        where: { action: 'RecordingUploadBound' },
      }),
      0,
    );
  } finally {
    await f.cleanup();
  }
});
