import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  PrismaClient,
  Course,
  BatchSession,
} from '../src/generated/prisma/client';
import { readAdminDashboard } from '../src/lib/admin/dashboard';
import { adminId } from '../src/lib/admin/handles';
import { isolatedDatabase } from './helpers/d4-database';

test('Admin dashboard preserves scoped reads, UTC boundaries and safe projections', async (t) => {
  const fixture = await isolatedDatabase(),
    db = fixture.db,
    now = new Date('2026-11-17T13:45:00.000Z');
  try {
    const batchAdmin = await db.user.create({
        data: {
          clerkUserId: 'dashboard-batches',
          role: 'ADMIN',
          adminAuthorization: { create: { permissions: ['BATCHES_MANAGE'] } },
        },
      }),
      academicAdmin = await db.user.create({
        data: {
          clerkUserId: 'dashboard-academics',
          role: 'ADMIN',
          adminAuthorization: { create: { permissions: ['ACADEMICS_MANAGE'] } },
        },
      }),
      supportAdmin = await db.user.create({
        data: {
          clerkUserId: 'dashboard-support',
          role: 'ADMIN',
          adminAuthorization: { create: { permissions: ['SUPPORT_MANAGE'] } },
        },
      }),
      governor = await db.user.create({
        data: {
          clerkUserId: 'dashboard-governor',
          role: 'ADMIN',
          adminAuthorization: { create: { authority: 'GOVERNANCE' } },
        },
      }),
      noPolicy = await db.user.create({
        data: { clerkUserId: 'dashboard-no-policy', role: 'ADMIN' },
      }),
      emptyPolicy = await db.user.create({
        data: {
          clerkUserId: 'dashboard-empty-policy',
          role: 'ADMIN',
          adminAuthorization: { create: {} },
        },
      }),
      noRole = await db.user.create({
        data: {
          clerkUserId: 'dashboard-policy-without-role',
          adminAuthorization: { create: { authority: 'GOVERNANCE' } },
        },
      }),
      student = await db.user.create({
        data: {
          clerkUserId: 'dashboard-student',
          lmsAccessOverride: 'ENABLED',
        },
      }),
      program = await db.program.create({
        data: { title: 'Dashboard Program' },
      }),
      batch = await db.batch.create({
        data: { code: 'DASHBOARD', name: 'Dashboard Batch', status: 'ACTIVE' },
      });
    const courses: Course[] = [];
    for (let i = 0; i < 7; i++) {
      courses.push(
        await db.course.create({
          data: {
            title: `Dashboard Course ${i}`,
            description: 'Private description excluded from the dashboard.',
            thumbnailPath: '/images/campus.webp',
            thumbnailAlt: 'Campus',
            publicPath: '/#programs',
            published: i % 2 === 0,
            ...(i === 0 ? { programId: program.id } : {}),
          },
        }),
      );
    }
    await db.enrollment.create({
      data: { userId: student.id, courseId: courses[0].id },
    });
    const sessions: BatchSession[] = [];
    for (const [title, startsAt, status] of [
      ['Previous UTC day', '2026-11-16T23:59:59.999Z', 'SCHEDULED'],
      ['UTC midnight', '2026-11-17T00:00:00.000Z', 'SCHEDULED'],
      ['Morning class', '2026-11-17T02:00:00.000Z', 'SCHEDULED'],
      ['Afternoon class', '2026-11-17T10:00:00.000Z', 'SCHEDULED'],
      ['Evening class', '2026-11-17T18:00:00.000Z', 'SCHEDULED'],
      ['Late class', '2026-11-17T22:00:00.000Z', 'SCHEDULED'],
      ['Last UTC instant', '2026-11-17T23:59:59.999Z', 'SCHEDULED'],
      ['Next UTC day', '2026-11-18T00:00:00.000Z', 'SCHEDULED'],
      ['Cancelled class', '2026-11-17T01:00:00.000Z', 'CANCELLED'],
      ['Held class', '2026-11-17T01:30:00.000Z', 'HELD'],
    ] as const) {
      sessions.push(
        await db.batchSession.create({
          data: {
            batchId: batch.id,
            title,
            startsAt: new Date(startsAt),
            endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000),
            status,
            externalTargetId: 'private-meeting-target',
          },
        }),
      );
    }
    for (const [i, status, cleanup] of [
      [0, 'PUBLISHED', false],
      [1, 'PROCESSING', true],
      [2, 'READY', false],
      [3, 'READY', true],
      [4, 'PROCESSING', false],
    ] as const) {
      await db.batchSessionRecording.create({
        data: {
          sessionId: sessions[i].id,
          storageProvider: 'test-only',
          assetRef: `private-asset-${i}`,
          status,
          ...(['READY', 'PUBLISHED'].includes(status) ? { readyAt: now } : {}),
          ...(status === 'PUBLISHED' ? { publishedAt: now } : {}),
          ...(cleanup ? { cleanupRequestedAt: now } : {}),
        },
      });
    }
    await db.academicAudit.create({
      data: {
        actorId: governor.id,
        action: 'UnknownPrivateOperation',
        targetId: 'private-target',
        details: { privateBody: 'secret audit payload' },
      },
    });

    const calls: string[] = [],
      observed = db.$extends({
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }) {
              calls.push(`${model}.${operation}`);
              return query(args);
            },
          },
        },
      }) as unknown as PrismaClient;
    await t.test(
      'missing or empty policy returns only the original empty projection',
      async () => {
        for (const actor of [noPolicy, emptyPolicy]) {
          calls.length = 0;
          assert.deepEqual(await readAdminDashboard(observed, actor.id, now), {
            metrics: {},
            events: [],
          });
          assert.deepEqual(calls, [
            'User.findUnique',
            'AdminAuthorization.findUnique',
          ]);
        }
        calls.length = 0;
        await assert.rejects(readAdminDashboard(observed, noRole.id, now), {
          code: 'FORBIDDEN',
        });
        assert.deepEqual(calls, ['User.findUnique']);
      },
    );
    await t.test(
      'support-only capabilities omit every unrelated query and field',
      async () => {
        calls.length = 0;
        assert.deepEqual(
          await readAdminDashboard(observed, supportAdmin.id, now),
          {
            metrics: { support: 0 },
            events: [],
          },
        );
        assert.deepEqual(calls, [
          'User.findUnique',
          'AdminAuthorization.findUnique',
          'SupportTicket.count',
        ]);
      },
    );
    await t.test(
      'batch projection is bounded, opaque and excludes private targets and assets',
      async () => {
        calls.length = 0;
        const data = await readAdminDashboard(observed, batchAdmin.id, now);
        assert.deepEqual(data.metrics, {
          batches: 1,
          sessions: 8,
          recordings: 1,
        });
        assert.equal(data.readyRecordings, 1);
        assert.equal(data.learningCourses, undefined);
        assert.deepEqual(data.events, []);
        assert.equal(data.todaySessions?.timeZone, 'UTC');
        assert.equal(data.todaySessions?.date, '2026-11-17');
        assert.deepEqual(
          data.todaySessions?.rows.map((row) => row.title),
          [
            'UTC midnight',
            'Morning class',
            'Afternoon class',
            'Evening class',
            'Late class',
          ],
        );
        for (const row of data.todaySessions!.rows) {
          assert.deepEqual(Object.keys(row).sort(), [
            'batchName',
            'batchRef',
            'endsAt',
            'ref',
            'startsAt',
            'status',
            'title',
          ]);
          assert.equal(adminId('batch', row.batchRef), batch.id);
          assert.ok(
            sessions.some(
              (session) => session.id === adminId('session', row.ref),
            ),
          );
        }
        assert.ok(
          !calls.some((call) =>
            /^(Course|Enrollment|SupportTicket|AcademicAudit)\./.test(call),
          ),
        );
        assert.doesNotMatch(
          JSON.stringify(data),
          /private-meeting-target|private-asset-|externalTargetId|assetRef/,
        );
      },
    );
    await t.test(
      'both UTC endpoints are exact regardless of the supplied timestamp offset',
      async () => {
        const previous = await readAdminDashboard(
          db,
          batchAdmin.id,
          new Date('2026-11-17T01:00:00+05:30'),
        );
        assert.equal(previous.todaySessions?.date, '2026-11-16');
        assert.deepEqual(
          previous.todaySessions?.rows.map((row) => row.title),
          ['Previous UTC day'],
        );
        const next = await readAdminDashboard(
          db,
          batchAdmin.id,
          new Date('2026-11-18T00:00:00Z'),
        );
        assert.deepEqual(
          next.todaySessions?.rows.map((row) => row.title),
          ['Next UTC day'],
        );
        const last = await readAdminDashboard(
          db,
          batchAdmin.id,
          new Date('2026-11-17T23:59:59Z'),
        );
        assert.equal(last.todaySessions?.date, '2026-11-17');
        await db.batchSession.updateMany({
          where: {
            id: { in: sessions.slice(1, 6).map((session) => session.id) },
          },
          data: { status: 'CANCELLED' },
        });
        const boundary = await readAdminDashboard(db, batchAdmin.id, now);
        assert.deepEqual(
          boundary.todaySessions?.rows.map((row) => row.title),
          ['Last UTC instant'],
        );
      },
    );
    await t.test(
      'academic-only reads include catalog counts without batch or private fields',
      async () => {
        calls.length = 0;
        const data = await readAdminDashboard(observed, academicAdmin.id, now),
          expected = [...courses]
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, 5);
        assert.deepEqual(data.metrics, { courses: 4 });
        assert.equal(data.todaySessions, undefined);
        assert.equal(data.readyRecordings, undefined);
        assert.deepEqual(
          data.learningCourses?.map((course) =>
            adminId('course', course.courseRef),
          ),
          expected.map((course) => course.id),
        );
        for (const course of data.learningCourses!) {
          assert.deepEqual(Object.keys(course).sort(), [
            'courseRef',
            'enrollments',
            'program',
            'published',
            'title',
          ]);
          const id = adminId('course', course.courseRef);
          assert.equal(course.enrollments, id === courses[0].id ? 1 : 0);
          assert.equal(
            course.program,
            id === courses[0].id ? program.title : 'Independent',
          );
        }
        assert.ok(
          !calls.some((call) =>
            /^(Batch|BatchSession|BatchSessionRecording|AcademicAudit|SupportTicket)\./.test(
              call,
            ),
          ),
        );
      },
    );
    await t.test(
      'governance retains existing metrics and safe audit labels',
      async () => {
        const data = await readAdminDashboard(db, governor.id, now);
        assert.equal(data.metrics.students, 2);
        assert.equal(data.metrics.enabled, 1);
        assert.equal(data.metrics.enrollments, 1);
        assert.equal(data.metrics.courses, 4);
        assert.equal(data.metrics.support, 0);
        assert.deepEqual(
          data.events.map((event) => event.action),
          ['Unrecognized historical operation'],
        );
        assert.doesNotMatch(
          JSON.stringify(data),
          /UnknownPrivateOperation|private-target|secret audit payload|privateBody/,
        );
        assert.deepEqual(Object.keys(data.events[0]).sort(), ['action', 'at']);
      },
    );
    await t.test(
      'fresh persisted revocation removes newly introduced data immediately',
      async () => {
        await db.adminAuthorization.update({
          where: { userId: batchAdmin.id },
          data: { permissions: [] },
        });
        assert.deepEqual(await readAdminDashboard(db, batchAdmin.id, now), {
          metrics: {},
          events: [],
        });
      },
    );
  } finally {
    await fixture.cleanup();
  }
});
