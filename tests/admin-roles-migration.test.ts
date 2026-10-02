import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isolatedDatabase } from './helpers/d4-database';
test('Role migration is additive, clean-installable and enforces FK/unique constraints', async () => {
  const sql = readFileSync(
    'prisma/migrations/20261002190000_user_role_assignments/migration.sql',
    'utf8',
  );
  assert.ok(!/^\s*(DROP|DELETE|UPDATE|TRUNCATE)\s/im.test(sql));
  const f = await isolatedDatabase();
  try {
    assert.equal(await f.db.userRoleAssignment.count(), 0);
    await assert.rejects(
      f.db.userRoleAssignment.create({
        data: { userId: 'missing', role: 'ADMIN' },
      }),
    );
    const user = await f.db.user.create({
      data: { clerkUserId: 'migration_roles' },
    });
    const role = await f.db.userRoleAssignment.create({
      data: { userId: user.id, role: 'ADMIN' },
    });
    assert.ok(role.createdAt instanceof Date);
    await assert.rejects(
      f.db.userRoleAssignment.create({
        data: { userId: user.id, role: 'ADMIN' },
      }),
    );
    await assert.rejects(f.db.user.delete({ where: { id: user.id } }));
  } finally {
    await f.cleanup();
  }
});
test('Populated A1 upgrade leaves primary personas, Student IDs and relationships untouched, without role backfill', async () => {
  const f = await isolatedDatabase(
    undefined,
    '20261002180000_admin_a1_recordings',
  );
  try {
    const user = await f.db.user.create({
      data: { clerkUserId: 'old_roles_student', lmsAccessOverride: 'ENABLED' },
    });
    await f.db.user.create({
      data: { clerkUserId: 'old_roles_admin', role: 'ADMIN' },
    });
    const batch = await f.db.batch.create({
      data: { code: 'OLD-ROLE', name: 'Existing batch' },
    });
    const membership = await f.db.batchMembership.create({
      data: { userId: user.id, batchId: batch.id },
    });
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
    );
    assert.deepEqual(
      await f.db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
    assert.deepEqual(
      await f.db.batchMembership.findUniqueOrThrow({
        where: { id: membership.id },
      }),
      membership,
    );
    assert.equal(await f.db.userRoleAssignment.count(), 0);
  } finally {
    await f.cleanup();
  }
});
