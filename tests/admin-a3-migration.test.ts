import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isolatedDatabase } from './helpers/d4-database';
import { academicFixture } from './helpers/l3-fixtures';
import { Attempts } from '../src/lib/lms/attempts';
const migration =
  'prisma/migrations/20261003000000_admin_a3_operations/migration.sql';
test('A3 additive migration clean install and review/hold database constraints', async () => {
  const sql = readFileSync(migration, 'utf8');
  assert.ok(!/^\s*(DROP|DELETE|UPDATE|TRUNCATE)\s/im.test(sql));
  const f = await isolatedDatabase();
  try {
    const db = f.db,
      student = await db.user.create({
        data: {
          clerkUserId: 'a3_migration_student',
          lmsAccessOverride: 'ENABLED',
        },
      }),
      admin = await db.user.create({
        data: { clerkUserId: 'a3_migration_admin', role: 'ADMIN' },
      });
    const x = await academicFixture(db, student.id, 'a3mig');
    const attempts = new Attempts(db, student.id),
      attempt = await attempts.start(x.course.id, x.optional.id);
    const response = await db.academicResponse.findFirstOrThrow({
      where: { attemptId: attempt.id },
    });
    await assert.rejects(
      db.academicResponseReview.create({
        data: {
          responseId: response.id,
          reviewerId: admin.id,
          awardedPoints: 1,
        },
      }),
    );
    await attempts.save(x.course.id, x.optional.id, attempt.id, {
      answers: [{ questionId: x.short.id, text: 'Original immutable answer' }],
    });
    await attempts.submit(x.course.id, x.optional.id, attempt.id);
    const before = await db.academicResponse.findUniqueOrThrow({
      where: { id: response.id },
    });
    for (const points of [-1, 2])
      await assert.rejects(
        db.academicResponseReview.create({
          data: {
            responseId: response.id,
            reviewerId: admin.id,
            awardedPoints: points,
          },
        }),
      );
    await db.academicResponseReview.create({
      data: { responseId: response.id, reviewerId: admin.id, awardedPoints: 1 },
    });
    await db.academicResponseReview.update({
      where: { responseId: response.id },
      data: { awardedPoints: 0 },
    });
    await assert.rejects(
      db.academicResponseReview.delete({ where: { responseId: response.id } }),
    );
    await assert.rejects(
      db.academicResponse.update({
        where: { id: response.id },
        data: { awardedPoints: 1 },
      }),
    );
    assert.deepEqual(
      await db.academicResponse.findUniqueOrThrow({
        where: { id: response.id },
      }),
      before,
    );
    const cert = await db.certificate.create({
      data: { userId: student.id, courseId: x.course.id, code: 'A3-MIG-CERT' },
    });
    assert.equal(cert.adminSuspended, false);
    await assert.rejects(
      db.certificate.update({
        where: { id: cert.id },
        data: { adminSuspended: true },
      }),
    );
    await db.certificate.update({
      where: { id: cert.id },
      data: { adminSuspended: true, status: 'SUSPENDED' },
    });
  } finally {
    await f.cleanup();
  }
});
test('A3 populated upgrade defaults false without response, enrollment or certificate history rewrite', async () => {
  const f = await isolatedDatabase(
    undefined,
    '20261002190000_user_role_assignments',
  );
  try {
    const db = f.db,
      user = await db.user.create({
        data: { clerkUserId: 'a3_old', lmsAccessOverride: 'ENABLED' },
      }),
      x = await academicFixture(db, user.id, 'a3old');
    // Explicit scalar baseline; the new optional review relation is not queried before migration.
    const response = await db.academicResponse.create({
      data: {
        attempt: {
          create: { userId: user.id, activityId: x.optional.id, number: 1 },
        },
        questionId: x.short.id,
        type: 'SHORT_TEXT',
        prompt: 'Snapshot',
        position: 1,
        points: 1,
      },
    });
    const before = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${f.schema}"`);
      await tx.$executeRaw`INSERT INTO "Certificate" (id,code,"userId","courseId",status) VALUES ('a3_old_certificate','A3-OLD-CERT',${user.id},${x.course.id},'SUSPENDED')`;
      return tx.$queryRaw`SELECT * FROM "Certificate" WHERE id='a3_old_certificate'`;
    });
    const enrollment = await db.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: user.id, courseId: x.course.id } },
    });
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
    );
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
    assert.deepEqual(
      await db.academicResponse.findUniqueOrThrow({
        where: { id: response.id },
      }),
      response,
    );
    assert.deepEqual(
      await db.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
      enrollment,
    );
    const cert = await db.certificate.findUniqueOrThrow({
      where: { id: 'a3_old_certificate' },
    });
    assert.equal(cert.adminSuspended, false);
    const { adminSuspended: hold, ...old } = cert;
    assert.equal(hold, false);
    assert.deepEqual([old], before);
    assert.equal(await db.academicResponseReview.count(), 0);
  } finally {
    await f.cleanup();
  }
});
