import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase, testDatabaseUrl } from './helpers/d4-database';
import { academicFixture } from './helpers/l3-fixtures';
import {
  Discussions,
  threadInput,
  postInput,
} from '../src/lib/lms/discussions';
import { BatchCommunications } from '../src/lib/lms/communications';
import { LmsAccessAdmin } from '../src/lib/lms/access-admin';
import { Academics } from '../src/lib/lms/academics';
import { LearningRepository } from '../src/lib/lms/learning';
import { AcademicStaff } from '../src/lib/lms/academic-staff';
import { LocalMutationLimiter } from '../src/lib/student/abuse';
import {
  approvedRequestHost,
  deploymentOrigins,
  domainRoute,
  lmsInternalPath,
} from '../src/lib/platform/domains';
import { dashboardDestination } from '../src/lib/auth/redirects';
test('strict discussion commands and bounded local abuse policy', () => {
  assert.ok(
    !threadInput.safeParse({
      courseId: 'c',
      title: 'ok title',
      body: 'text',
      authorId: 'other',
    }).success,
  );
  assert.ok(!postInput.safeParse({ body: 'x', role: 'ADMIN' }).success);
  assert.ok(!postInput.safeParse({ body: 'x'.repeat(6001) }).success);
  const limiter = new LocalMutationLimiter();
  for (let i = 0; i < 20; i++) limiter.check('A', 'discussion', 1000);
  assert.throws(() => limiter.check('A', 'discussion', 1000), {
    code: 'RATE_LIMITED',
  });
  limiter.check('B', 'discussion', 1000);
  limiter.check('A', 'academic', 1000);
  limiter.check('A', 'discussion', 61000);
});
test('host and discussion handoff boundaries reject spoofing, traversal and redirect injection', () => {
  const origins = deploymentOrigins(
    'https://mentoralm.com',
    'https://students.mentoralm.com',
  );
  for (const host of [
    'mentoralm.com.attacker.test',
    'evil.test',
    'mentoralm.com@evil.test',
    'mentoralm.com/',
    'mentoralm.com\\evil',
    'students.mentoralm.com?x',
  ])
    assert.equal(approvedRequestHost(host, origins), false);
  assert.equal(approvedRequestHost('students.mentoralm.com', origins), true);
  assert.equal(
    approvedRequestHost('students.mentoralm.com:443', origins),
    true,
  );
  assert.equal(
    domainRoute('students.mentoralm.com', '/discussions/thread', origins).path,
    '/learn/discussions/thread',
  );
  assert.equal(
    lmsInternalPath('/learn/discussions/thread'),
    '/learn/discussions/thread',
  );
  assert.equal(
    dashboardDestination('/learn/discussions/thread'),
    '/learn/discussions/thread',
  );
  assert.equal(lmsInternalPath('/learn/discussions/../x'), null);
});
test('live identity configuration fails closed unless both production origins are explicit', () => {
  const previous = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
    'pk_live_configuration_fixture';
  try {
    assert.throws(() => deploymentOrigins(undefined, undefined));
    assert.throws(() =>
      deploymentOrigins('http://localhost:3000', 'http://localhost:3001'),
    );
    assert.equal(
      deploymentOrigins(
        'https://mentoralm.com',
        'https://students.mentoralm.com',
      ).lms,
      'https://students.mentoralm.com',
    );
  } finally {
    if (previous === undefined)
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previous;
  }
});
test(
  'L4 PostgreSQL communication, discussion, audit, integration and populated L3 upgrade',
  { skip: !testDatabaseUrl() },
  async (t) => {
    const isolated = await isolatedDatabase(
        undefined,
        '20261001100000_academic_engine',
      ),
      db = isolated.db;
    try {
      const A = await db.user.create({
          data: { clerkUserId: 'l4-a', lmsAccessOverride: 'ENABLED' },
        }),
        B = await db.user.create({
          data: { clerkUserId: 'l4-b', lmsAccessOverride: 'ENABLED' },
        }),
        C = await db.user.create({
          data: { clerkUserId: 'l4-c', lmsAccessOverride: 'ENABLED' },
        }),
        I = await db.user.create({
          data: { clerkUserId: 'l4-i', role: 'INSTRUCTOR' },
        }),
        admin = await db.user.create({
          data: { clerkUserId: 'l4-admin', role: 'ADMIN' },
        });
      const f = await academicFixture(db, A.id, 'l4domain');
      await db.batchInstructor.create({
        data: { batchId: f.batch.id, instructorId: I.id },
      });
      // Populated L3 records, including private snapshots and submitted/reviewed state.
      const academic = new Academics(db, A),
        staff = new AcademicStaff(db, I.id),
        learning = new LearningRepository(db, A);
      const attempt = await academic.attempts.start(f.course.id, f.quiz.id);
      await academic.attempts.save(f.course.id, f.quiz.id, attempt.id, {
        answers: attempt.questions.map((q) => ({
          questionId: q.id,
          optionIds:
            q.id === f.multi.id
              ? f.multi.options.filter((o) => o.correct).map((o) => o.id)
              : [q.options[0].id],
        })),
      });
      // L4 event tables do not exist until upgrade; seed old submitted snapshot through existing schema mechanics.
      const version = await db.assignmentSubmission.create({
        data: {
          userId: A.id,
          assignmentId: f.assignment.id,
          versions: {
            create: {
              number: 1,
              requestKey: randomUUID(),
              kind: 'TEXT',
              text: 'Preserved L3 work',
            },
          },
        },
        include: { versions: true },
      });
      await db.lessonState.create({
        data: {
          userId: A.id,
          itemId: f.lesson.id,
          firstAccessedAt: new Date('2026-01-01'),
          lastAccessedAt: new Date('2026-01-01'),
          completedAt: new Date('2026-01-01'),
        },
      });
      await db.attendanceRecord.create({
        data: {
          sessionId: f.session.id,
          membershipId: f.membership.id,
          userId: A.id,
          status: 'PRESENT',
        },
      });
      const certificate = await db.certificate.create({
        data: {
          userId: A.id,
          courseId: f.course.id,
          code: 'L3-PRESERVED-CERT',
          status: 'SUSPENDED',
        },
      });
      await db.assignmentReview.create({
        data: {
          versionId: version.versions[0].id,
          reviewerId: I.id,
          status: 'CHANGES_REQUESTED',
          feedback: 'Preserved L3 feedback',
        },
      });
      await db.submissionVersion.update({
        where: { id: version.versions[0].id },
        data: { status: 'CHANGES_REQUESTED' },
      });
      await db.submissionFile.create({
        data: {
          versionId: version.versions[0].id,
          fileName: 'preserved.pdf',
          mimeType: 'application/pdf',
          bytes: 20,
          storageKey: 'preserved-private.pdf',
        },
      });
      const counts = {
        users: await db.user.count(),
        memberships: await db.batchMembership.count(),
        enrollments: await db.enrollment.count(),
        reviews: await db.assignmentReview.count(),
        files: await db.submissionFile.count(),
        attempts: await db.academicAttempt.count(),
        responses: await db.academicResponse.count(),
        versions: await db.submissionVersion.count(),
        states: await db.lessonState.count(),
        attendance: await db.attendanceRecord.count(),
        certificates: await db.certificate.count(),
      };
      execFileSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
        { env: { ...process.env, DATABASE_URL: isolated.url }, stdio: 'pipe' },
      );
      await t.test(
        'additive upgrade preserves every populated L3 boundary and issued Student ID',
        async () => {
          assert.deepEqual(
            {
              users: await db.user.count(),
              memberships: await db.batchMembership.count(),
              enrollments: await db.enrollment.count(),
              reviews: await db.assignmentReview.count(),
              files: await db.submissionFile.count(),
              attempts: await db.academicAttempt.count(),
              responses: await db.academicResponse.count(),
              versions: await db.submissionVersion.count(),
              states: await db.lessonState.count(),
              attendance: await db.attendanceRecord.count(),
              certificates: await db.certificate.count(),
            },
            counts,
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: A.id } }))
              .studentId,
            A.studentId,
          );
          assert.equal(
            (
              await db.submissionVersion.findUniqueOrThrow({
                where: { id: version.versions[0].id },
              })
            ).text,
            'Preserved L3 work',
          );
          assert.equal(
            (
              await db.certificate.findUniqueOrThrow({
                where: { id: certificate.id },
              })
            ).code,
            'L3-PRESERVED-CERT',
          );
          assert.equal(await db.discussionThread.count(), 0);
          assert.equal(await db.learningEvent.count(), 0);
        },
      );
      const discussions = new Discussions(db, A.id),
        other = new Discussions(db, B.id),
        stranger = new Discussions(db, C.id),
        communications = new BatchCommunications(db, admin.id),
        instructor = new BatchCommunications(db, I.id),
        access = new LmsAccessAdmin(db, admin.id);
      let threadId = '';
      await t.test(
        'saved academic activity resumes through the single Dashboard/LMS projection',
        async () => {
          await academic.attempts.save(f.course.id, f.quiz.id, attempt.id, {
            answers: attempt.questions.map((q) => ({
              questionId: q.id,
              optionIds:
                q.id === f.multi.id
                  ? f.multi.options.filter((o) => o.correct).map((o) => o.id)
                  : [q.options[0].id],
            })),
          });
          const c = await learning.course(f.course.id),
            summaries = await learning.dashboardSummaries();
          assert.equal(c.progress.nextItem?.id, f.quiz.id);
          assert.equal(c.progress.lastAccessedLesson, null);
          assert.ok(c.progress.lastAccessedAt);
          assert.deepEqual(summaries[0].progress, c.progress);
          await academic.attempts.submit(f.course.id, f.quiz.id, attempt.id);
          assert.equal((await academic.recentResult())?.item.id, f.quiz.id);
          assert.equal(
            await db.learningEvent.count({
              where: { kind: 'QuizResultAvailable' },
            }),
            1,
          );
          await academic.attempts.submit(f.course.id, f.quiz.id, attempt.id);
          assert.equal(
            await db.learningEvent.count({
              where: { kind: 'QuizResultAvailable' },
            }),
            1,
          );
        },
      );
      await t.test(
        'scoped communication audience excludes inactive members but never confuses entitlement with consent',
        async () => {
          await db.batchMembership.createMany({
            data: [
              { userId: B.id, batchId: f.batch.id },
              { userId: C.id, batchId: f.batch.id, status: 'INACTIVE' },
            ],
          });
          await access.change({
            kind: 'STUDENT_OVERRIDE',
            userId: B.id,
            value: 'DISABLED',
          });
          const audience = await communications.audience(
            f.batch.id,
            'EMAIL',
            'MARKETING',
          );
          assert.deepEqual(
            audience.map((a) => a.userId).sort(),
            [A.id, B.id].sort(),
          );
          assert.ok(audience.every((a) => !a.allowed));
          await communications.preference(
            A.id,
            'EMAIL',
            'OPERATIONAL',
            true,
            'Explicit test consent',
          );
          assert.ok(
            (
              await communications.audience(f.batch.id, 'EMAIL', 'MARKETING')
            ).every((a) => !a.allowed),
          );
          await communications.preference(
            A.id,
            'EMAIL',
            'MARKETING',
            true,
            'Explicit separate marketing consent',
          );
          const message = await communications.plan({
            batchId: f.batch.id,
            channel: 'EMAIL',
            purpose: 'MARKETING',
            subject: 'Approved notice',
            body: 'No provider delivery',
          });
          const deliveries = await db.communicationDelivery.findMany({
            where: { messageId: message.id },
          });
          assert.equal(
            deliveries.find((d) => d.userId === A.id)?.status,
            'PENDING_PROVIDER',
          );
          assert.equal(
            deliveries.find((d) => d.userId === B.id)?.status,
            'SUPPRESSED',
          );
          assert.doesNotMatch(
            JSON.stringify(deliveries),
            /SENT|sentAt|providerReference/,
          );
          await assert.rejects(
            instructor.audience(f.batch.id, 'EMAIL', 'MARKETING'),
            { code: 'FORBIDDEN' },
          );
          await instructor.audience(f.batch.id, 'EMAIL', 'OPERATIONAL');
          await assert.rejects(
            new BatchCommunications(db, A.id).plan({
              batchId: f.batch.id,
              channel: 'IN_APP',
              purpose: 'OPERATIONAL',
              subject: 'Spoof',
              body: 'no',
            }),
            { code: 'FORBIDDEN' },
          );
          await assert.rejects(
            new BatchCommunications(db, A.id).preference(
              A.id,
              'EMAIL',
              'MARKETING',
              true,
              'spoof',
            ),
            { code: 'FORBIDDEN' },
          );
          await assert.rejects(
            communications.plan({
              batchId: f.batch.id,
              channel: 'EMAIL',
              purpose: 'OPERATIONAL',
              subject: 'x',
              body: 'x',
              userIds: [C.id],
            }),
            { code: 'INVALID_INPUT' },
          );
          await access.change({
            kind: 'STUDENT_OVERRIDE',
            userId: B.id,
            value: 'ENABLED',
          });
        },
      );
      await t.test(
        'Course/Batch thread creation, immutable authors, replies, XSS-safe DTO and cross-scope denial',
        async () => {
          const thread = await discussions.create({
            courseId: f.course.id,
            batchId: f.batch.id,
            title: 'A learning question',
            body: '<script>window.__discussionXss=true</script>',
          });
          threadId = thread.id;
          await assert.rejects(other.thread(threadId), { code: 'NOT_FOUND' }); // Batch membership alone never enrollment.
          await db.enrollment.create({
            data: { userId: B.id, courseId: f.course.id },
          });
          await other.thread(threadId);
          await assert.rejects(stranger.thread(threadId), {
            code: 'NOT_FOUND',
          });
          await assert.rejects(
            discussions.create({
              courseId: f.course.id,
              title: 'Spoof author',
              body: 'x',
              authorId: B.id,
            }),
            { code: 'INVALID_INPUT' },
          );
          await assert.rejects(
            discussions.reply(threadId, { body: 'x', locked: false }),
            { code: 'INVALID_INPUT' },
          );
          await Promise.all(
            Array.from({ length: 8 }, (_, i) =>
              other.reply(threadId, { body: `Reply ${i}` }),
            ),
          );
          assert.equal((await discussions.thread(threadId)).posts.length, 9);
          assert.equal(
            await db.learningEvent.count({
              where: { kind: 'DiscussionReply' },
            }),
            8,
          );
          const dto = JSON.stringify(await discussions.thread(threadId));
          assert.doesNotMatch(dto, /authorId|userId|clerkUserId|studentId/);
          assert.match(dto, /<script>/);
          await db.batchMembership.update({
            where: { userId_batchId: { userId: B.id, batchId: f.batch.id } },
            data: { status: 'INACTIVE' },
          });
          await assert.rejects(other.thread(threadId), { code: 'NOT_FOUND' });
          await assert.rejects(other.reply(threadId, { body: 'denied' }), {
            code: 'NOT_FOUND',
          });
          const courseOnly = await discussions.create({
            courseId: f.course.id,
            title: 'Course members',
            body: 'Question',
          });
          await other.thread(courseOnly.id);
          const unrelated = await db.batch.create({
            data: {
              code: 'UNRELATED-L4',
              name: 'Other Course',
              courseId: (
                await db.course.create({
                  data: {
                    title: 'Other',
                    description: '',
                    thumbnailPath: '/images/campus.webp',
                    thumbnailAlt: '',
                    publicPath: '/#programs',
                  },
                })
              ).id,
              status: 'ACTIVE',
            },
          });
          await db.batchMembership.create({
            data: { batchId: unrelated.id, userId: A.id },
          });
          await db.enrollment.create({
            data: { userId: C.id, courseId: unrelated.courseId! },
          });
          await assert.rejects(stranger.thread(threadId), {
            code: 'NOT_FOUND',
          });
          await assert.rejects(
            discussions.create({
              courseId: f.course.id,
              batchId: unrelated.id,
              title: 'Wrong context',
              body: 'x',
            }),
            { code: 'NOT_FOUND' },
          );
          await assert.rejects(
            db.discussionThread.update({
              where: { id: threadId },
              data: { authorId: B.id },
            }),
          );
          const post = await db.discussionPost.findFirstOrThrow({
            where: { threadId },
          });
          await assert.rejects(
            db.discussionPost.update({
              where: { id: post.id },
              data: { body: 'changed' },
            }),
          );
          await db.discussionThread.update({
            where: { id: threadId },
            data: { locked: true },
          });
          await assert.rejects(
            discussions.reply(threadId, { body: 'locked' }),
            { code: 'CONFLICT' },
          );
        },
      );
      await t.test(
        'cursor pagination is thread-bound and every page reauthorizes',
        async () => {
          await db.discussionPost.createMany({
            data: Array.from({ length: 55 }, (_, i) => ({
              threadId,
              authorId: A.id,
              body: `Post ${i}`,
            })),
          });
          const latest = await discussions.thread(threadId);
          assert.equal(latest.posts.length, 50);
          assert.ok(latest.older);
          const older = await discussions.thread(threadId, latest.older!);
          assert.equal(older.posts.length, 14);
          assert.equal(
            new Set([...latest.posts, ...older.posts].map((p) => p.id)).size,
            64,
          );
          await assert.rejects(discussions.thread(threadId, 'missing'), {
            code: 'NOT_FOUND',
          });
        },
      );
      await t.test(
        'review/completion/certificate facts are atomic, idempotent and private',
        async () => {
          await staff.review(
            version.versions[0].id,
            'ACCEPTED',
            'Reviewed',
            f.batch.id,
          );
          const a = await academic.attempts.start(f.course.id, f.assessment.id);
          await academic.attempts.save(f.course.id, f.assessment.id, a.id, {
            answers: a.questions.map((q) =>
              q.type === 'SINGLE_CHOICE'
                ? { questionId: q.id, optionIds: [q.options[0].id] }
                : { questionId: q.id, text: 'Reflection' },
            ),
          });
          await academic.attempts.submit(f.course.id, f.assessment.id, a.id);
          assert.equal(
            (await learning.course(f.course.id)).completion.eligible,
            true,
          );
          assert.equal(
            (
              await db.enrollment.findUniqueOrThrow({
                where: {
                  userId_courseId: { userId: A.id, courseId: f.course.id },
                },
              })
            ).status,
            'COMPLETED',
          );
          assert.equal(
            await db.learningEvent.count({
              where: { kind: 'AssessmentResultAvailable' },
            }),
            1,
          );
          assert.equal(
            await db.learningEvent.count({
              where: { kind: 'CourseCompleted' },
            }),
            1,
          );
          assert.equal(
            await db.learningEvent.count({
              where: { kind: 'AssignmentReviewed' },
            }),
            1,
          );
          await learning.record(f.course.id, f.lesson.id, true);
          assert.equal(
            await db.learningEvent.count({
              where: { kind: 'CourseCompleted' },
            }),
            1,
          );
          assert.equal(
            await db.certificate.count({
              where: { userId: A.id, courseId: f.course.id },
            }),
            1,
          );
        },
      );
      await t.test(
        'future access control plane rejects students and records revocation immediately',
        async () => {
          await assert.rejects(
            new LmsAccessAdmin(db, A.id).change({
              kind: 'BATCH_ACCESS',
              batchId: f.batch.id,
              value: true,
            }),
            { code: 'FORBIDDEN' },
          );
          await access.change({
            kind: 'STUDENT_OVERRIDE',
            userId: A.id,
            value: 'DISABLED',
          });
          await assert.rejects(discussions.workspace(), { code: 'FORBIDDEN' });
          await assert.rejects(discussions.thread(threadId), {
            code: 'NOT_FOUND',
          });
          await assert.rejects(academic.attendance(), { code: 'FORBIDDEN' });
          assert.equal(await academic.recentResult(), null);
          assert.ok(
            (await db.academicAudit.count({ where: { actorId: admin.id } })) >
              0,
          );
          await access.change({
            kind: 'STUDENT_OVERRIDE',
            userId: A.id,
            value: null,
          });
          await access.change({
            kind: 'BATCH_ACCESS',
            batchId: f.batch.id,
            value: false,
          });
          await assert.rejects(discussions.workspace(), { code: 'FORBIDDEN' });
          await access.change({
            kind: 'STUDENT_OVERRIDE',
            userId: A.id,
            value: 'ENABLED',
          });
          await discussions.workspace();
          await access.change({
            kind: 'ENROLLMENT',
            userId: A.id,
            courseId: f.course.id,
            value: null,
          });
          await assert.rejects(discussions.thread(threadId), {
            code: 'NOT_FOUND',
          });
        },
      );
    } finally {
      await isolated.cleanup();
    }
  },
);
