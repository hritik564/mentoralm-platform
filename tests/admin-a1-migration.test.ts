import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { isolatedDatabase } from './helpers/d4-database';
test('A1 clean migration and recording constraints', async () => {
  const f = await isolatedDatabase();
  try {
    const batch = await f.db.batch.create({
      data: { code: 'MIG-A1', name: 'Migration fixture' },
    });
    const session = await f.db.batchSession.create({
      data: {
        batchId: batch.id,
        title: 'Existing session',
        startsAt: new Date('2026-10-01'),
        endsAt: new Date('2026-10-02'),
      },
    });
    assert.equal(session.instructorId, null);
    await assert.rejects(
      f.db.batchSessionRecording.create({
        data: {
          sessionId: session.id,
          storageProvider: 'fixture',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      }),
    );
    const record = await f.db.batchSessionRecording.create({
      data: { sessionId: session.id, storageProvider: 'fixture' },
    });
    assert.equal(record.status, 'UPLOADING');
    await assert.rejects(
      f.db.batchSession.delete({ where: { id: session.id } }),
    );
    await assert.rejects(
      f.db.batchSessionRecording.update({
        where: { sessionId: session.id },
        data: { assetRef: 'https://public.example/video.mp4' },
      }),
    );
    await assert.rejects(
      f.db.batchSessionRecording.update({
        where: { sessionId: session.id },
        data: { bytes: BigInt(-1) },
      }),
    );
  } finally {
    await f.cleanup();
  }
});
test('A1 additive upgrade preserves existing session/student/enrollment without backfill', async () => {
  const f = await isolatedDatabase(undefined, '20261001120000_lms_integration');
  try {
    const user = await f.db.user.create({
      data: { clerkUserId: 'migration_actor', lmsAccessOverride: 'ENABLED' },
    });
    const course = await f.db.course.create({
      data: {
        title: 'Existing course',
        description: 'Fixture',
        thumbnailPath: '/x',
        thumbnailAlt: 'x',
        publicPath: '/x',
      },
    });
    const batch = await f.db.batch.create({
      data: { code: 'OLD-A1', name: 'Existing batch', courseId: course.id },
    });
    // Raw insert uses only the pre-A1 columns.
    await f.db.$executeRawUnsafe(
      `INSERT INTO "${f.schema}"."BatchSession" (id,"batchId",title,"startsAt","endsAt",status) VALUES ('old_session','${batch.id}','Old session','2026-10-01','2026-10-02','HELD')`,
    );
    await f.db.enrollment.create({
      data: { userId: user.id, courseId: course.id },
    });
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
    );
    assert.equal(
      (
        await f.db.batchSession.findUniqueOrThrow({
          where: { id: 'old_session' },
        })
      ).instructorId,
      null,
    );
    assert.equal(
      (await f.db.user.findUniqueOrThrow({ where: { id: user.id } })).studentId,
      user.studentId,
    );
    assert.equal(await f.db.enrollment.count(), 1);
    assert.equal(await f.db.batchSessionRecording.count(), 0);
  } finally {
    await f.cleanup();
  }
});
