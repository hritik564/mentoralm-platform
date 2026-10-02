import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase } from './helpers/d4-database';
import {
  getEffectiveRoles,
  hasRole,
  requireAdmin,
} from '../src/lib/auth/roles';
import { changeAdditionalAdmin } from '../scripts/admin-owner/assignment';
import { studentSnapshot } from '../scripts/admin-owner/snapshot';
import { academicFixture } from './helpers/l3-fixtures';
import { LearningRepository } from '../src/lib/lms/learning';
import { AcademicStaff } from '../src/lib/lms/academic-staff';
import { AdminRepository } from '../src/lib/admin/repository';
import { localSeedUrl } from '../scripts/lms-owner/safety';

test('Additional ADMIN is persisted, revocable and preserves Student domain history', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db;
  try {
    const student = await db.user.create({
      data: { clerkUserId: 'roles_student', lmsAccessOverride: 'ENABLED' },
    });
    const legacy = await db.user.create({
      data: { clerkUserId: 'roles_admin', role: 'ADMIN' },
    });
    const instructor = await db.user.create({
      data: { clerkUserId: 'roles_instructor', role: 'INSTRUCTOR' },
    });
    const fixture = await academicFixture(db, student.id, 'roles');
    await db.attendanceRecord.create({
      data: {
        userId: student.id,
        membershipId: fixture.membership.id,
        sessionId: fixture.session.id,
        status: 'ABSENT',
      },
    });
    await db.lessonState.create({
      data: {
        userId: student.id,
        itemId: fixture.lesson.id,
        firstAccessedAt: new Date('2026-01-01T00:00:00Z'),
        lastAccessedAt: new Date('2026-01-01T00:00:00Z'),
        completedAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const before = await studentSnapshot(db, student.id),
      learning = new LearningRepository(db, student);
    const projection = await learning.course(fixture.course.id);
    const directory = { search: async () => [], lookup: async () => new Map() };
    const admin = new AdminRepository(db, student.id, directory);
    await t.test('primary STUDENT denied', async () => {
      await assert.rejects(admin.overview(), { code: 'FORBIDDEN' });
    });
    await t.test(
      'legacy primary ADMIN allowed without assignment backfill',
      async () => {
        await requireAdmin(db, legacy.id);
        assert.equal(await db.userRoleAssignment.count(), 0);
      },
    );
    await t.test('INSTRUCTOR and unprovisioned identity denied', async () => {
      await assert.rejects(requireAdmin(db, instructor.id), {
        code: 'FORBIDDEN',
      });
      await assert.rejects(requireAdmin(db, 'missing_clerk_user'), {
        code: 'FORBIDDEN',
      });
    });
    await t.test(
      'additional INSTRUCTOR does not broaden Instructor authority',
      async () => {
        await db.userRoleAssignment.create({
          data: { userId: student.id, role: 'INSTRUCTOR' },
        });
        await assert.rejects(
          new AcademicStaff(db, student.id).reconcile(
            student.id,
            fixture.course.id,
          ),
          { code: 'FORBIDDEN' },
        );
        await db.userRoleAssignment.delete({
          where: { userId_role: { userId: student.id, role: 'INSTRUCTOR' } },
        });
      },
    );
    await t.test('grant permits same Student to use Admin', async () => {
      assert.equal(
        (await changeAdditionalAdmin(db, student.id, 'grant')).changed,
        true,
      );
      assert.ok(hasRole(await getEffectiveRoles(db, student.id), 'STUDENT'));
      assert.ok(hasRole(await getEffectiveRoles(db, student.id), 'ADMIN'));
      await admin.overview();
    });
    await t.test(
      'Student LMS still enforces entitlement and Enrollment',
      async () => {
        assert.deepEqual(await learning.course(fixture.course.id), projection);
        const other = await db.user.create({
          data: { clerkUserId: 'roles_unentitled' },
        });
        await changeAdditionalAdmin(db, other.id, 'grant');
        await assert.rejects(
          new LearningRepository(db, other).course(fixture.course.id),
          { code: 'FORBIDDEN' },
        );
        await db.user.update({
          where: { id: other.id },
          data: { lmsAccessOverride: 'ENABLED' },
        });
        await assert.rejects(
          new LearningRepository(db, other).course(fixture.course.id),
          { code: 'NOT_FOUND' },
        );
      },
    );
    await t.test(
      'Student ID, memberships, enrollments, attendance and progress unchanged',
      async () => {
        assert.deepEqual(await studentSnapshot(db, student.id), before);
      },
    );
    await t.test(
      'concurrent duplicate grants are idempotent and auditable',
      async () => {
        const results = await Promise.all([
          changeAdditionalAdmin(db, student.id, 'grant'),
          changeAdditionalAdmin(db, student.id, 'grant'),
        ]);
        assert.ok(results.every((r) => !r.changed));
        assert.equal(
          await db.userRoleAssignment.count({
            where: { userId: student.id, role: 'ADMIN' },
          }),
          1,
        );
        assert.equal(
          await db.academicAudit.count({
            where: { targetId: student.id, action: 'LOCAL_ADMIN_ROLE_GRANTED' },
          }),
          3,
        );
      },
    );
    await t.test(
      'client role claims rejected and cannot grant role',
      async () => {
        await assert.rejects(
          admin.override(student.id, {
            value: 'ENABLED',
            role: 'ADMIN',
            roleAssignments: ['ADMIN'],
          }),
          { code: 'INVALID_INPUT' },
        );
        assert.equal(
          await db.userRoleAssignment.count({ where: { userId: student.id } }),
          1,
        );
      },
    );
    await t.test(
      'revoke denies existing Admin service immediately and preserves LMS',
      async () => {
        assert.equal(
          (await changeAdditionalAdmin(db, student.id, 'revoke')).changed,
          true,
        );
        await assert.rejects(admin.overview(), { code: 'FORBIDDEN' });
        await assert.rejects(
          admin.override(student.id, { value: 'DISABLED' }),
          { code: 'FORBIDDEN' },
        );
        assert.deepEqual(await learning.course(fixture.course.id), projection);
        assert.deepEqual(await studentSnapshot(db, student.id), before);
      },
    );
    await t.test(
      'duplicate revoke no-op audited; unknown User never created',
      async () => {
        assert.equal(
          (await changeAdditionalAdmin(db, student.id, 'revoke')).changed,
          false,
        );
        assert.equal(
          await db.academicAudit.count({
            where: { targetId: student.id, action: 'LOCAL_ADMIN_ROLE_REVOKED' },
          }),
          2,
        );
        const count = await db.user.count();
        await assert.rejects(
          changeAdditionalAdmin(db, 'not_provisioned', 'grant'),
        );
        assert.equal(await db.user.count(), count);
      },
    );
    await t.test(
      'revoking an additional role never changes legacy primary ADMIN',
      async () => {
        await changeAdditionalAdmin(db, legacy.id, 'revoke');
        await requireAdmin(db, legacy.id);
      },
    );
  } finally {
    await f.cleanup();
  }
});
test('Operator rejects production, remote, deployed Admin origin and wrong database/schema', () => {
  const base = {
    CLERK_SECRET_KEY: 'sk_test_fixture',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture',
    DATABASE_URL: 'postgresql://localhost/mentoralm_dev?schema=public',
  };
  assert.ok(localSeedUrl(base));
  for (const change of [
    { NODE_ENV: 'production' },
    { CLERK_SECRET_KEY: 'sk_live_fixture' },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_fixture' },
    { NEXT_PUBLIC_ADMIN_ORIGIN: 'https://admin.mentoralm.com' },
    { DATABASE_URL: 'postgresql://remote/mentoralm_dev' },
    { DATABASE_URL: 'postgresql://localhost/mentoralm_test' },
    { DATABASE_URL: 'postgresql://localhost/mentoralm_dev?schema=other' },
  ])
    assert.throws(() => localSeedUrl({ ...base, ...change }));
});
