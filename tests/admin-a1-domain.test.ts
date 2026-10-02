import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, testDatabaseUrl } from './helpers/d4-database';
import { AdminRepository } from '../src/lib/admin/repository';
import {
  AdminRecordings,
  authorizedRecording,
  type RecordingStore,
} from '../src/lib/admin/recordings';
import { adminHandle, adminId } from '../src/lib/admin/handles';
import { adminDestination, domainRoute } from '../src/lib/platform/domains';
import type { Directory } from '../src/lib/admin/directory';
const directory: Directory = {
  search: async (q) => (q === 'Alice' ? ['alice'] : []),
  lookup: async (ids) =>
    new Map(
      ids.map((id) => [
        id,
        {
          name: id === 'alice' ? 'Alice Student' : id,
          email: `${id}@example.test`,
          phone: null,
          status: 'Active' as const,
        },
      ]),
    ),
};
test('Admin opaque references and safe destinations', () => {
  const h = adminHandle('student', 'private_id');
  assert.equal(adminId('student', h), 'private_id');
  assert.ok(!h.includes('private_id'));
  assert.throws(() => adminId('batch', h));
  assert.throws(() => adminId('student', h.slice(0, -2) + 'xx'));
  assert.equal(adminDestination('https://attacker.test/admin'), '/admin');
  assert.equal(
    domainRoute('admin.mentoralm.com', '/students').path,
    '/admin/students',
  );
  assert.equal(
    domainRoute('admin.mentoralm.com', '/sign-in').path,
    '/admin-auth/sign-in',
  );
});
test('Test database guard rejects Development target', () => {
  const saved = process.env.TEST_DATABASE_URL;
  try {
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
    assert.throws(testDatabaseUrl);
  } finally {
    process.env.TEST_DATABASE_URL = saved;
  }
});
test('A1 persisted authority, Students, entitlement, Enrollment, Batches and session Instructor', async () => {
  const f = await isolatedDatabase(),
    db = f.db;
  try {
    const admin = await db.user.create({
        data: { clerkUserId: 'admin', role: 'ADMIN' },
      }),
      instructor = await db.user.create({
        data: { clerkUserId: 'teacher', role: 'INSTRUCTOR' },
      }),
      student = await db.user.create({
        data: { clerkUserId: 'alice', lmsAccessOverride: 'ENABLED' },
      });
    const r = new AdminRepository(db, admin.id, directory),
      denied = new AdminRepository(db, student.id, directory);
    for (const work of [
      () => denied.overview(),
      () => denied.students(),
      () => denied.student(student.id),
      () => denied.batches(),
      () => denied.choices('instructors'),
      () => denied.override(student.id, { value: 'ENABLED' }),
    ])
      await assert.rejects(work, { code: 'FORBIDDEN' });
    await assert.rejects(
      new AdminRepository(db, instructor.id, directory).overview(),
      { code: 'FORBIDDEN' },
    );
    for (let i = 0; i < 22; i++)
      await db.user.create({ data: { clerkUserId: `student_${i}` } });
    assert.equal((await r.students()).rows.length, 20);
    assert.equal((await r.students({ page: '2' })).rows.length, 3);
    assert.equal((await r.students({ q: 'Alice' })).total, 1);
    assert.equal((await r.student(student.id)).identity.name, 'Alice Student');
    await assert.rejects(r.student(instructor.id), { code: 'NOT_FOUND' });
    await assert.rejects(
      r.override(student.id, { value: 'ENABLED', actorId: admin.id }),
      { code: 'INVALID_INPUT' },
    );
    const course = await db.course.create({
      data: {
        title: 'Canonical course',
        description: 'Real test course',
        thumbnailPath: '/images/campus.webp',
        thumbnailAlt: 'Campus',
        publicPath: '/#programs',
        published: true,
      },
    });
    const batchId = await r.saveBatch(null, {
      code: 'A1-TEST',
      name: 'A1 Batch',
      status: 'ACTIVE',
      programId: null,
      courseId: course.id,
      startsAt: null,
      endsAt: null,
      lmsAccessEnabled: true,
    });
    await r.membership(batchId, { userId: student.id, status: 'ACTIVE' });
    assert.equal(await db.enrollment.count(), 0);
    await r.override(student.id, { value: 'INHERIT' });
    assert.equal((await r.effective(student.id)).enabled, true);
    await r.batchAccess(batchId, false);
    assert.equal((await r.effective(student.id)).enabled, false);
    await r.override(student.id, { value: 'ENABLED' });
    assert.equal((await r.effective(student.id)).enabled, true);
    await r.batchAccess(batchId, true);
    await r.override(student.id, { value: 'DISABLED' });
    assert.equal((await r.effective(student.id)).enabled, false);
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: student.id } }))
        .lmsAccessOverride,
      'DISABLED',
    );
    await r.override(student.id, { value: 'INHERIT' });
    await r.membership(batchId, { userId: student.id, status: 'INACTIVE' });
    assert.equal((await r.effective(student.id)).enabled, false);
    assert.ok((await db.batchMembership.findFirstOrThrow()).leftAt);
    await r.membership(batchId, { userId: student.id, status: 'ACTIVE' });
    await r.enrollment(student.id, { courseId: course.id, value: 'ENROLLED' });
    await r.enrollment(student.id, {
      courseId: course.id,
      value: 'IN_PROGRESS',
    });
    assert.equal(
      (await db.enrollment.findFirstOrThrow()).status,
      'IN_PROGRESS',
    );
    await assert.rejects(
      r.enrollment(student.id, { courseId: course.id, value: 'COMPLETED' }),
      { code: 'INVALID_INPUT' },
    );
    await r.enrollment(student.id, { courseId: course.id, value: null });
    assert.equal(await db.enrollment.count(), 0);
    await assert.rejects(
      r.instructor(batchId, { instructorId: student.id, assigned: true }),
      { code: 'NOT_FOUND' },
    );
    const section = await db.section.create({
        data: {
          courseId: course.id,
          title: 'Sessions',
          position: 1,
          published: true,
        },
      }),
      item = await db.learningItem.create({
        data: {
          sectionId: section.id,
          type: 'LIVE_SESSION',
          title: 'Live session',
          position: 1,
          published: true,
        },
      });
    const command = {
      title: 'Operational session',
      courseId: course.id,
      itemId: item.id,
      instructorId: instructor.id,
      startsAt: '2026-10-01T10:00:00Z',
      endsAt: '2026-10-01T11:00:00Z',
      status: 'HELD',
      externalTargetId: null,
      locationLabel: null,
    };
    await assert.rejects(r.session(batchId, null, command), {
      code: 'FORBIDDEN',
    });
    await r.instructor(batchId, {
      instructorId: instructor.id,
      assigned: true,
    });
    const sessionId = await r.session(batchId, null, command);
    assert.equal(
      (await db.batchSession.findUniqueOrThrow({ where: { id: sessionId } }))
        .instructorId,
      instructor.id,
    );
    await r.session(batchId, sessionId, { ...command, instructorId: null });
    await r.session(batchId, sessionId, command);
    const other = await db.batch.create({
      data: { code: 'OTHER', name: 'Other Batch' },
    });
    await assert.rejects(
      r.session(other.id, sessionId, { ...command, instructorId: null }),
      { code: 'NOT_FOUND' },
    );
    await r.instructor(batchId, {
      instructorId: instructor.id,
      assigned: false,
    });
    assert.equal(
      (await db.batchSession.findUniqueOrThrow({ where: { id: sessionId } }))
        .instructorId,
      instructor.id,
    );
    await assert.rejects(db.user.delete({ where: { id: instructor.id } }));
    assert.ok(
      (await db.academicAudit.count({ where: { actorId: admin.id } })) >= 15,
    );
    await db.user.update({
      where: { id: admin.id },
      data: { role: 'STUDENT' },
    });
    await assert.rejects(r.students(), { code: 'FORBIDDEN' });
    await assert.rejects(r.batchAccess(batchId, false), { code: 'FORBIDDEN' });
  } finally {
    await f.cleanup();
  }
});
test('Recording readiness, concurrency, exact Batch policy, cleanup and attendance isolation', async () => {
  const f = await isolatedDatabase(),
    db = f.db;
  try {
    const admin = await db.user.create({
        data: { clerkUserId: 'admin', role: 'ADMIN' },
      }),
      learner = await db.user.create({
        data: { clerkUserId: 'learner', lmsAccessOverride: 'ENABLED' },
      }),
      late = await db.user.create({
        data: { clerkUserId: 'late', lmsAccessOverride: 'ENABLED' },
      }),
      wrong = await db.user.create({
        data: { clerkUserId: 'wrong', lmsAccessOverride: 'ENABLED' },
      });
    const course = await db.course.create({
        data: {
          title: 'Recording course',
          description: 'Private recordings',
          published: true,
          thumbnailPath: '/images/campus.webp',
          thumbnailAlt: 'Campus',
          publicPath: '/#programs',
        },
      }),
      section = await db.section.create({
        data: {
          courseId: course.id,
          title: 'Sessions',
          position: 1,
          published: true,
        },
      }),
      item = await db.learningItem.create({
        data: {
          sectionId: section.id,
          title: 'Session context',
          type: 'LIVE_SESSION',
          position: 1,
          published: true,
        },
      }),
      batch = await db.batch.create({
        data: { code: 'RECORD', name: 'Recording Batch', courseId: course.id },
      }),
      other = await db.batch.create({
        data: { code: 'FOREIGN', name: 'Foreign Batch' },
      }),
      session = await db.batchSession.create({
        data: {
          batchId: batch.id,
          courseId: course.id,
          itemId: item.id,
          title: 'Recorded live session',
          startsAt: new Date('2026-09-01'),
          endsAt: new Date('2026-09-02'),
          status: 'HELD',
        },
      });
    for (const u of [learner, late, wrong])
      await db.enrollment.create({
        data: { userId: u.id, courseId: course.id },
      });
    await db.batchMembership.create({
      data: {
        userId: learner.id,
        batchId: batch.id,
        status: 'INACTIVE',
        joinedAt: new Date('2026-08-01'),
        leftAt: new Date('2026-09-15'),
      },
    });
    await db.batchMembership.create({
      data: {
        userId: late.id,
        batchId: batch.id,
        status: 'ACTIVE',
        joinedAt: new Date('2026-09-20'),
      },
    });
    await db.batchMembership.create({
      data: {
        userId: wrong.id,
        batchId: other.id,
        status: 'ACTIVE',
        joinedAt: new Date('2026-08-01'),
      },
    });
    await db.attendanceRecord.create({
      data: {
        sessionId: session.id,
        userId: learner.id,
        status: 'ABSENT',
        membershipId: (
          await db.batchMembership.findUniqueOrThrow({
            where: {
              userId_batchId: { batchId: batch.id, userId: learner.id },
            },
          })
        ).id,
      },
    });
    await assert.rejects(
      new AdminRecordings(db, learner.id).change(session.id, {
        action: 'UPLOAD',
      }),
      { code: 'FORBIDDEN' },
    );
    await assert.rejects(
      new AdminRecordings(db, admin.id).change(session.id, {
        action: 'UPLOAD',
      }),
      { code: 'UNAVAILABLE' },
    );
    assert.equal(await db.batchSessionRecording.count(), 0);
    let ready = false,
      providerFailed = false,
      failRemove = false;
    const removed: string[] = [];
    const store: RecordingStore = {
      name: 'private-test-adapter',
      begin: async (revision) => ({ assetRef: `objects/${revision}` }),
      inspect: async (_r, assetRef) => ({
        ready,
        failed: providerFailed,
        assetRef: assetRef!,
        bytes: BigInt(1200),
        mimeType: 'video/mp4',
        durationSeconds: 60,
      }),
      remove: async (revision) => {
        if (failRemove) throw Error('provider unavailable');
        removed.push(revision);
      },
      deliver: async () => new Response('authorized'),
    };
    const recordings = new AdminRecordings(db, admin.id, store);
    const started = await Promise.allSettled([
      recordings.change(session.id, { action: 'UPLOAD' }),
      recordings.change(session.id, { action: 'UPLOAD' }),
    ]);
    assert.equal(started.filter((r) => r.status === 'fulfilled').length, 1);
    const record = await db.batchSessionRecording.findUniqueOrThrow({
        where: { sessionId: session.id },
      }),
      revision = record.revision;
    await assert.rejects(
      recordings.change(session.id, { action: 'PUBLISH', revision }),
      { code: 'CONFLICT' },
    );
    await recordings.reconcile(session.id, revision);
    assert.equal(
      (
        await db.batchSessionRecording.findUniqueOrThrow({
          where: { sessionId: session.id },
        })
      ).status,
      'PROCESSING',
    );
    ready = true;
    await recordings.reconcile(session.id, revision);
    await recordings.change(session.id, { action: 'PUBLISH', revision });
    for (const u of [learner, late])
      assert.equal(
        (await authorizedRecording(db, u.id, course.id, item.id, session.id))
          .revision,
        revision,
      );
    await assert.rejects(
      authorizedRecording(db, wrong.id, course.id, item.id, session.id),
      { code: 'NOT_FOUND' },
    );
    assert.equal(
      (await db.attendanceRecord.findFirstOrThrow()).status,
      'ABSENT',
    );
    assert.equal(await db.lessonState.count(), 0);
    await db.batchMembership.update({
      where: { userId_batchId: { userId: late.id, batchId: batch.id } },
      data: { status: 'INACTIVE', leftAt: new Date('2026-09-25') },
    });
    await assert.rejects(
      authorizedRecording(db, late.id, course.id, item.id, session.id),
      { code: 'NOT_FOUND' },
    );
    await db.batchMembership.update({
      where: { userId_batchId: { userId: late.id, batchId: batch.id } },
      data: { status: 'ACTIVE', leftAt: null },
    });

    await db.user.update({
      where: { id: late.id },
      data: { lmsAccessOverride: 'DISABLED' },
    });
    await assert.rejects(
      authorizedRecording(db, late.id, course.id, item.id, session.id),
      { code: 'NOT_FOUND' },
    );
    await db.user.update({
      where: { id: late.id },
      data: { lmsAccessOverride: 'ENABLED' },
    });
    await db.enrollment.delete({
      where: { userId_courseId: { userId: late.id, courseId: course.id } },
    });
    await assert.rejects(
      authorizedRecording(db, late.id, course.id, item.id, session.id),
      { code: 'NOT_FOUND' },
    );
    await db.section.update({
      where: { id: section.id },
      data: { published: false },
    });
    await assert.rejects(
      authorizedRecording(db, learner.id, course.id, item.id, session.id),
    );
    await db.section.update({
      where: { id: section.id },
      data: {
        published: true,
      },
    });
    await assert.rejects(
      recordings.change(session.id, {
        action: 'UNPUBLISH',
        revision: '00000000-0000-4000-8000-000000000000',
      }),
      { code: 'CONFLICT' },
    );
    failRemove = true;
    await assert.rejects(
      recordings.change(session.id, { action: 'REPLACE', revision }),
    );
    const pending = await db.batchSessionRecording.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    assert.ok(pending.cleanupRequestedAt);
    assert.equal(pending.publishedAt, null);
    await assert.rejects(
      authorizedRecording(db, learner.id, course.id, item.id, session.id),
      { code: 'NOT_FOUND' },
    );
    await assert.rejects(recordings.reconcile(session.id, revision), {
      code: 'CONFLICT',
    });
    failRemove = false;
    await recordings.change(session.id, { action: 'RETRY_CLEANUP', revision });
    assert.deepEqual(removed, [revision]);
    assert.equal(await db.batchSessionRecording.count(), 0);
    await recordings.change(session.id, { action: 'UPLOAD' });
    const next = await db.batchSessionRecording.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    assert.notEqual(next.revision, revision);
    providerFailed = true;
    await recordings.reconcile(session.id, next.revision);
    assert.equal(
      (
        await db.batchSessionRecording.findUniqueOrThrow({
          where: { sessionId: session.id },
        })
      ).status,
      'FAILED',
    );
    await assert.rejects(
      recordings.change(session.id, {
        action: 'PUBLISH',
        revision: next.revision,
      }),
      { code: 'CONFLICT' },
    );
    await recordings.change(session.id, {
      action: 'DELETE',
      revision: next.revision,
    });
    assert.equal(await db.batchSessionRecording.count(), 0);

    await assert.rejects(recordings.reconcile(session.id, revision), {
      code: 'CONFLICT',
    });
    assert.ok(
      await db.academicAudit.count({
        where: { action: 'RecordingCleanupConfirmed' },
      }),
    );
    assert.equal(
      (await db.attendanceRecord.findFirstOrThrow()).status,
      'ABSENT',
    );
  } finally {
    await f.cleanup();
  }
});
