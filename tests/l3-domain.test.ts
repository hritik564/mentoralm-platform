import { legacyAdminPermissions } from '../src/lib/admin/permissions';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  isolatedDatabase,
  testDatabaseUrl,
  migrationCount,
} from './helpers/d4-database';
import { academicFixture } from './helpers/l3-fixtures';
import { Academics } from '../src/lib/lms/academics';
import { AcademicStaff } from '../src/lib/lms/academic-staff';
import { LearningRepository } from '../src/lib/lms/learning';
import {
  academicTransaction,
  finalizeCourseProjection,
  evaluateCompletion,
} from '../src/lib/lms/completion';
import {
  academicCompletion,
  exactMatch,
  answersInput,
  submissionInput,
} from '../src/lib/lms/academic-rules';
import { privateFileResponse } from '../src/lib/storage/private-files';
import {
  lmsInternalPath,
  lmsHref,
  learningItemHref,
} from '../src/lib/platform/domains';
import { dashboardDestination } from '../src/lib/auth/redirects';
import { resolveLearningLaunch } from '../src/lib/dashboard/learning-launch';
const pdf = Buffer.from('%PDF-1.4\nfixture');
test('exact-match objective policy and strict server input', () => {
  assert.equal(
    academicCompletion('QUIZ', true, true, 66.7, [
      {
        submittedAt: new Date(),
        percentage: (2 / 3) * 100,
        requiresReview: false,
      },
    ]).complete,
    false,
  );
  assert.ok(exactMatch(['a', 'b'], ['b', 'a']));
  assert.ok(!exactMatch(['a'], ['a', 'b']));
  assert.ok(!exactMatch(['a', 'a'], ['a', 'b']));
  assert.ok(!answersInput.safeParse({ answers: [], score: 100 }).success);
  assert.ok(
    !submissionInput.safeParse({
      requestKey: randomUUID(),
      kind: 'TEXT',
      text: 'work',
      status: 'ACCEPTED',
    }).success,
  );
});
test('course attendance threshold uses counts rather than rounded display percentage', () => {
  const course = {
    id: 'course',
    title: 'Course',
    description: '',
    hasAcademicItems: true,
    programId: null,
    program: null,
    academicCompletionEnabled: true,
    certificateEnabled: true,
    requiredAttendancePercent: 66.7,
    sections: [],
    progress: {
      requiredItems: 1,
      completedItems: 1,
      percentage: 100,
      lastAccessedAt: null,
      lastAccessedLesson: null,
      nextItem: null,
      nextLesson: null,
    },
  };
  const attendance = {
    sessions: [],
    total: 3,
    present: 2,
    late: 0,
    absent: 1,
    excused: 0,
    unrecorded: 0,
    percentage: 66.7,
  };
  assert.equal(
    finalizeCourseProjection(course, attendance).completion.eligible,
    false,
  );
});
test('academic routes preserve approved-domain and narrow redirect boundary', () => {
  for (const kind of ['activities', 'assignments']) {
    const path = `/learn/courses/course/${kind}/item`;
    assert.equal(lmsInternalPath(path), path);
    assert.equal(dashboardDestination(path), path);
  }
  assert.equal(
    lmsInternalPath('/certificates/MLM-ABC'),
    '/learn/certificates/MLM-ABC',
  );
  assert.equal(
    learningItemHref('course', { id: 'item', type: 'QUIZ' }),
    '/learn/courses/course/activities/item',
  );
  assert.equal(
    resolveLearningLaunch({
      destinationId: 'lms-course-course',
      item: { id: 'item', type: 'ASSESSMENT' },
    }),
    '/learn/courses/course/activities/item',
  );
  assert.throws(() => lmsHref('/learn/certificates/../../x'));
});
test(
  'PostgreSQL academic lifecycle, authorization, history and completion',
  { skip: !testDatabaseUrl() },
  async (t) => {
    const isolated = await isolatedDatabase(),
      db = isolated.db,
      root = await mkdtemp(join(tmpdir(), 'mentoralm-l3-domain-')),
      old = process.env.LMS_SUBMISSIONS_ROOT,
      oldMedia = process.env.LMS_FILES_ROOT;
    process.env.LMS_SUBMISSIONS_ROOT = root;
    process.env.LMS_FILES_ROOT = root;
    try {
      const A = await db.user.create({
          data: { clerkUserId: 'l3-A', lmsAccessOverride: 'ENABLED' },
        }),
        B = await db.user.create({
          data: { clerkUserId: 'l3-B', lmsAccessOverride: 'ENABLED' },
        }),
        I = await db.user.create({
          data: { clerkUserId: 'l3-I', role: 'INSTRUCTOR' },
        }),
        U = await db.user.create({
          data: { clerkUserId: 'l3-unscoped', role: 'INSTRUCTOR' },
        }),
        Admin = await db.user.create({
          data: {
            clerkUserId: 'l3-admin',
            role: 'ADMIN',
            adminAuthorization: {
              create: { permissions: legacyAdminPermissions },
            },
          },
        });
      const f = await academicFixture(db, A.id, 'domain'),
        repo = new Academics(db, A),
        other = new Academics(db, B),
        learning = new LearningRepository(db, A),
        staff = new AcademicStaff(db, I.id),
        unscoped = new AcademicStaff(db, U.id),
        admin = new AcademicStaff(db, Admin.id);
      await db.batchInstructor.create({
        data: { batchId: f.batch.id, instructorId: I.id },
      });
      let quizId = '',
        firstVersion = '';
      async function answers(
        id: string,
        activityId: string,
        correct: boolean,
        text = false,
      ) {
        const view = await repo.attempts.view(f.course.id, activityId),
          attempt = view.attempts.find((a) => a.id === id)!;
        return {
          answers: attempt.questions.map((q) =>
            ['SHORT_TEXT', 'LONG_TEXT'].includes(q.type)
              ? { questionId: q.id, text: 'My reflection' }
              : {
                  questionId: q.id,
                  optionIds: correct
                    ? q.id === f.multi.id
                      ? f.multi.options
                          .filter((o) => o.correct)
                          .map((o) => o.id)
                      : [
                          f.single.id === q.id
                            ? f.single.options[0].id
                            : f.boolean.options[0].id,
                        ]
                    : [q.options.at(-1)!.id],
                },
          ),
          ...(text ? { score: 100 } : {}),
        };
      }
      await t.test(
        'clean repository migrations and subtype/policy constraints',
        async () => {
          const count = await db.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT count(*) FROM "${isolated.schema}"."_prisma_migrations" WHERE finished_at IS NOT NULL`,
          );
          assert.equal(Number(count[0].count), migrationCount());
          await assert.rejects(
            db.academicActivity.create({
              data: {
                itemId: f.lesson.id,
                itemType: 'LESSON',
                instructions: 'invalid',
              },
            }),
          );
          await assert.rejects(
            db.academicActivity.update({
              where: { itemId: f.quiz.id },
              data: { passingPercent: 101 },
            }),
          );
        },
      );
      await t.test(
        'own start resumes, answer keys/explanations absent before submit, unrelated students denied',
        async () => {
          const started = await Promise.all(
            Array.from({ length: 6 }, () =>
              repo.attempts.start(f.course.id, f.quiz.id),
            ),
          );
          quizId = started[0].id;
          assert.equal(new Set(started.map((a) => a.id)).size, 1);
          assert.doesNotMatch(
            JSON.stringify(started),
            /"correct"|"explanation"|"awardedPoints"|"passingPercent"/,
          );
          await assert.rejects(other.attempts.start(f.course.id, f.quiz.id), {
            code: 'NOT_FOUND',
          });
          await db.enrollment.create({
            data: { userId: B.id, courseId: f.course.id },
          });
          await assert.rejects(
            other.attempts.save(f.course.id, f.quiz.id, quizId, {
              answers: [],
            }),
            { code: 'NOT_FOUND' },
          );
          await assert.rejects(
            repo.attempts.save(
              f.course.id,
              f.quiz.id,
              quizId,
              await answers(quizId, f.quiz.id, true, true),
            ),
            { code: 'INVALID_INPUT' },
          );
          await assert.rejects(
            repo.attempts.submit(f.course.id, f.quiz.id, quizId),
            { code: 'INVALID_INPUT' },
          );
        },
      );
      await t.test(
        'responses persist, failed quiz does not complete, multiple-choice requires exact match',
        async () => {
          await repo.attempts.save(
            f.course.id,
            f.quiz.id,
            quizId,
            await answers(quizId, f.quiz.id, false),
          );
          const submitted = await repo.attempts.submit(
            f.course.id,
            f.quiz.id,
            quizId,
          );
          assert.equal(submitted.score, 0);
          assert.equal(submitted.maxScore, 6);
          assert.equal(submitted.passed, false);
          assert.match(JSON.stringify(submitted), /"correct"/);
          assert.equal(
            (await learning.course(f.course.id)).progress.percentage,
            0,
          );
          await assert.rejects(
            repo.attempts.save(f.course.id, f.quiz.id, quizId, { answers: [] }),
            { code: 'FORBIDDEN' },
          );
          await assert.rejects(
            db.academicResponse.updateMany({
              where: { attemptId: quizId },
              data: { text: 'tamper' },
            }),
          );
        },
      );
      await t.test(
        'simultaneous successful submission is idempotent and scoring snapshot survives edits',
        async () => {
          const a = await repo.attempts.start(f.course.id, f.quiz.id);
          await repo.attempts.save(
            f.course.id,
            f.quiz.id,
            a.id,
            await answers(a.id, f.quiz.id, true),
          );
          await db.questionOption.update({
            where: { id: f.single.options[0].id },
            data: { correct: false },
          });
          await db.questionOption.update({
            where: { id: f.single.options[1].id },
            data: { correct: true },
          });
          const results = await Promise.all(
            Array.from({ length: 8 }, () =>
              repo.attempts.submit(f.course.id, f.quiz.id, a.id),
            ),
          );
          assert.ok(results.every((r) => r.score === 6 && r.passed));
          assert.equal(new Set(results.map((r) => r.submittedAt)).size, 1);
          assert.equal(
            (await learning.course(f.course.id)).progress.percentage,
            25,
          );
          await db.questionOption.update({
            where: { id: f.single.options[0].id },
            data: { correct: true },
          });
          await db.questionOption.update({
            where: { id: f.single.options[1].id },
            data: { correct: false },
          });
          const third = await repo.attempts.start(f.course.id, f.quiz.id);
          await repo.attempts.save(
            f.course.id,
            f.quiz.id,
            third.id,
            await answers(third.id, f.quiz.id, true),
          );
          await repo.attempts.submit(f.course.id, f.quiz.id, third.id);
          await assert.rejects(repo.attempts.start(f.course.id, f.quiz.id), {
            code: 'FORBIDDEN',
          });
        },
      );
      await t.test(
        'Assessment objective/text responses persist without invented grading or interpretation',
        async () => {
          const a = await repo.attempts.start(f.course.id, f.assessment.id);
          await repo.attempts.save(
            f.course.id,
            f.assessment.id,
            a.id,
            await answers(a.id, f.assessment.id, true),
          );
          const result = await repo.attempts.submit(
            f.course.id,
            f.assessment.id,
            a.id,
          );
          assert.equal(result.requiresReview, true);
          assert.equal(result.passed, null);
          assert.equal(result.score, 1);
          assert.equal(result.maxScore, 3);
          assert.doesNotMatch(
            JSON.stringify(result),
            /careerRecommendation|personality|studentDNA|correct|explanation/,
          );
          assert.equal(
            (await learning.course(f.course.id)).progress.percentage,
            50,
          );
          await assert.rejects(
            other.attempts.submit(f.course.id, f.assessment.id, a.id),
            { code: 'NOT_FOUND' },
          );
        },
      );
      await t.test(
        'assignment file validation, own submission and accepted-status spoofing denied',
        async () => {
          await assert.rejects(
            repo.assignments.submit(f.course.id, f.assignment.id, {
              requestKey: randomUUID(),
              kind: 'TEXT',
              text: 'x',
              status: 'ACCEPTED',
            }),
            { code: 'INVALID_INPUT' },
          );
          for (const file of [
            new File(['<script>'], 'bad.html', { type: 'text/html' }),
            new File(['wrong'], 'bad.pdf', { type: 'application/pdf' }),
            new File(['data'], '../path.txt', { type: 'text/plain' }),
            new File([Buffer.alloc(1024 * 1024 + 1)], 'large.txt', {
              type: 'text/plain',
            }),
          ])
            await assert.rejects(
              repo.assignments.submit(
                f.course.id,
                f.assignment.id,
                { requestKey: randomUUID(), kind: 'FILE' },
                [file],
              ),
            );
          const version = await repo.assignments.submit(
            f.course.id,
            f.assignment.id,
            {
              requestKey: randomUUID(),
              kind: 'TEXT_AND_FILE',
              text: 'Version one',
            },
            [new File([pdf], 'notes.pdf', { type: 'application/pdf' })],
          );
          firstVersion = version.id;
          assert.equal(version.number, 1);
          const view = await repo.assignments.view(
            f.course.id,
            f.assignment.id,
          );
          assert.equal(view.versions[0].text, 'Version one');
          assert.doesNotMatch(
            JSON.stringify(view),
            /storageKey|reviewerId|userId/,
          );
          await assert.rejects(
            other.assignments.file(
              f.course.id,
              f.assignment.id,
              view.versions[0].files[0].id,
            ),
            { code: 'NOT_FOUND' },
          );
          const record = await repo.assignments.file(
            f.course.id,
            f.assignment.id,
            view.versions[0].files[0].id,
          );
          const response = await privateFileResponse(
            new Request('http://local/file?download=1'),
            record,
            root,
          );
          assert.equal(response.status, 200);
          assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
        },
      );
      await t.test(
        'instructor review is scoped and audited; changes request enables immutable resubmissions',
        async () => {
          await assert.rejects(
            new AcademicStaff(db, A.id).review(
              firstVersion,
              'ACCEPTED',
              'fake',
            ),
            { code: 'FORBIDDEN' },
          );
          await assert.rejects(
            unscoped.review(firstVersion, 'ACCEPTED', 'fake', f.batch.id),
            { code: 'FORBIDDEN' },
          );
          await staff.review(
            firstVersion,
            'CHANGES_REQUESTED',
            'Please refine the notes.',
            f.batch.id,
          );
          const results = await Promise.all(
            Array.from({ length: 5 }, (_, i) =>
              repo.assignments.submit(f.course.id, f.assignment.id, {
                requestKey: randomUUID(),
                kind: 'TEXT',
                text: `Revision ${i}`,
              }),
            ),
          );
          assert.deepEqual(
            results.map((r) => r.number).sort((a, b) => a - b),
            [2, 3, 4, 5, 6],
          );
          const current = (
            await repo.assignments.view(f.course.id, f.assignment.id)
          ).versions[0];
          await staff.review(
            current.id,
            'ACCEPTED',
            'Accepted after review.',
            f.batch.id,
          );
          await assert.rejects(
            repo.assignments.submit(f.course.id, f.assignment.id, {
              requestKey: randomUUID(),
              kind: 'TEXT',
              text: 'locked',
            }),
            { code: 'FORBIDDEN' },
          );
          const original = await db.submissionVersion.findUniqueOrThrow({
            where: { id: firstVersion },
          });
          assert.equal(original.text, 'Version one');
          await assert.rejects(
            db.submissionVersion.update({
              where: { id: firstVersion },
              data: { text: 'overwrite' },
            }),
          );
          assert.equal(
            (await learning.course(f.course.id)).progress.percentage,
            75,
          );
        },
      );
      await t.test(
        'submission idempotency and submit-only policy contribute without fabricated review',
        async () => {
          const item = await db.learningItem.create({
            data: {
              sectionId: f.section.id,
              title: 'Optional submission',
              type: 'ASSIGNMENT',
              position: 6,
              published: true,
              required: false,
              assignment: {
                create: {
                  published: true,
                  instructions: 'Submit',
                  allowedKinds: ['TEXT'],
                  requiresAcceptance: false,
                },
              },
            },
          });
          const key = randomUUID(),
            versions = await Promise.all(
              Array.from({ length: 5 }, () =>
                repo.assignments.submit(f.course.id, item.id, {
                  requestKey: key,
                  kind: 'TEXT',
                  text: 'Same request',
                }),
              ),
            );
          assert.equal(new Set(versions.map((v) => v.id)).size, 1);
          assert.equal(
            (await repo.assignments.view(f.course.id, item.id)).versions.length,
            1,
          );
          assert.equal(
            (await learning.course(f.course.id)).progress.percentage,
            75,
          );
        },
      );
      await t.test(
        'attendance own-only, membership scope, no student writes and historical retention',
        async () => {
          await assert.rejects(
            new AcademicStaff(db, A.id).attendance(
              f.session.id,
              f.membership.id,
              'PRESENT',
            ),
            { code: 'FORBIDDEN' },
          );
          await assert.rejects(
            unscoped.attendance(f.session.id, f.membership.id, 'PRESENT'),
            { code: 'FORBIDDEN' },
          );
          const wrongBatch = await db.batch.create({
              data: { code: 'OTHER', name: 'Other' },
            }),
            wrong = await db.batchMembership.create({
              data: { batchId: wrongBatch.id, userId: B.id },
            });
          await assert.rejects(
            staff.attendance(f.session.id, wrong.id, 'PRESENT'),
            { code: 'FORBIDDEN' },
          );
          await assert.rejects(
            db.attendanceRecord.create({
              data: {
                sessionId: f.session.id,
                userId: B.id,
                membershipId: wrong.id,
                status: 'PRESENT',
              },
            }),
          );
          await staff.attendance(f.session.id, f.membership.id, 'PRESENT');
          assert.equal((await repo.attendance()).percentage, 100);
          assert.equal((await other.attendance()).total, 0);
          await db.batchMembership.update({
            where: { id: f.membership.id },
            data: { status: 'INACTIVE', leftAt: new Date('2026-09-15') },
          });
          assert.equal((await repo.attendance()).present, 1);
          await db.batchMembership.update({
            where: { id: f.membership.id },
            data: { status: 'ACTIVE', leftAt: null },
          });
          assert.ok((await db.academicAudit.count()) > 0);
        },
      );
      await t.test(
        'mixed completion, attendance condition, Enrollment and certificate races remain authoritative',
        async () => {
          await db.course.update({
            where: { id: f.course.id },
            data: { requiredAttendancePercent: 100 },
          });
          await staff.attendance(f.session.id, f.membership.id, 'ABSENT');
          await learning.record(f.course.id, f.lesson.id, true);
          const course = await learning.course(f.course.id);
          assert.equal(course.progress.percentage, 100);
          assert.equal(course.completion.eligible, false);
          assert.equal(await db.certificate.count(), 0);
          await staff.attendance(f.session.id, f.membership.id, 'LATE');
          await Promise.all(
            Array.from({ length: 8 }, () =>
              academicTransaction(db, (tx) =>
                evaluateCompletion(tx, A.id, f.course.id),
              ),
            ),
          );
          const enrollment = await db.enrollment.findUniqueOrThrow({
            where: { userId_courseId: { userId: A.id, courseId: f.course.id } },
          });
          assert.equal(enrollment.status, 'COMPLETED');
          assert.ok(enrollment.completedAt);
          assert.equal(
            await db.certificate.count({
              where: { userId: A.id, courseId: f.course.id },
            }),
            1,
          );
          await assert.rejects(
            new AcademicStaff(db, A.id).reconcile(A.id, f.course.id),
            { code: 'FORBIDDEN' },
          );
          await assert.rejects(
            unscoped.reconcile(A.id, f.course.id, f.batch.id),
            { code: 'FORBIDDEN' },
          );
          await staff.reconcile(A.id, f.course.id, f.batch.id);
          const cert = (await repo.certificates())[0];
          assert.equal(cert.documentAvailable, false);
          assert.ok(cert.code.length > 35);
          await assert.rejects(other.certificate(cert.code), {
            code: 'NOT_FOUND',
          });
          await assert.rejects(repo.certificateFile(cert.code), {
            code: 'UNAVAILABLE',
          });
          await assert.rejects(
            new AcademicStaff(db, A.id).revokeCertificate(cert.code),
            { code: 'FORBIDDEN' },
          );
          const timestamp = enrollment.completedAt.toISOString();
          await academicTransaction(db, (tx) =>
            evaluateCompletion(tx, A.id, f.course.id),
          );
          assert.equal(
            (
              await db.enrollment.findUniqueOrThrow({
                where: { id: enrollment.id },
              })
            ).completedAt?.toISOString(),
            timestamp,
          );
          await writeFile(join(root, 'certificate.pdf'), pdf);
          await db.certificate.update({
            where: { code: cert.code },
            data: {
              storageKey: 'certificate.pdf',
              fileName: 'certificate.pdf',
              mimeType: 'application/pdf',
            },
          });
          assert.equal(
            (await repo.certificate(cert.code)).documentAvailable,
            true,
          );
          await admin.revokeCertificate(cert.code);
          assert.equal((await repo.certificates()).length, 0);
          await academicTransaction(db, (tx) =>
            evaluateCompletion(tx, A.id, f.course.id),
          );
          assert.equal(
            (
              await db.certificate.findUniqueOrThrow({
                where: { code: cert.code },
              })
            ).status,
            'REVOKED',
          );
        },
      );
      await t.test(
        'curriculum changes reopen managed completion, preserve first timestamp and hide ineligible certificates',
        async () => {
          const extra = await db.learningItem.create({
            data: {
              sectionId: f.section.id,
              title: 'New required lesson',
              type: 'LESSON',
              position: 7,
              published: true,
              lesson: {
                create: {
                  format: 'TEXT',
                  structuredContent: {
                    version: 1,
                    blocks: [{ type: 'paragraph', text: 'New requirement' }],
                  },
                },
              },
            },
          });
          await academicTransaction(db, (tx) =>
            evaluateCompletion(tx, A.id, f.course.id),
          );
          const enrollment = await db.enrollment.findUniqueOrThrow({
            where: { userId_courseId: { userId: A.id, courseId: f.course.id } },
          });
          assert.equal(enrollment.status, 'IN_PROGRESS');
          assert.ok(enrollment.completedAt);
          assert.equal(
            (await learning.course(f.course.id)).progress.percentage,
            80,
          );
          await learning.record(f.course.id, extra.id, true);
          assert.equal(
            (await learning.course(f.course.id)).completion.eligible,
            true,
          );
          const empty = await db.course.create({
            data: {
              title: 'Empty',
              description: '',
              published: true,
              academicCompletionEnabled: true,
              certificateEnabled: true,
              thumbnailPath: '/images/campus.webp',
              thumbnailAlt: '',
              publicPath: '/#programs',
              enrollments: { create: { userId: A.id } },
            },
          });
          await academicTransaction(db, (tx) =>
            evaluateCompletion(tx, A.id, empty.id),
          );
          assert.equal(
            (await learning.course(empty.id)).completion.eligible,
            false,
          );
          assert.equal(
            await db.certificate.count({ where: { courseId: empty.id } }),
            0,
          );
        },
      );
      await t.test(
        'unpublishing, entitlement and Enrollment revocation stop subsequent academic access',
        async () => {
          await db.academicActivity.update({
            where: { itemId: f.quiz.id },
            data: { published: false },
          });
          await assert.rejects(repo.attempts.view(f.course.id, f.quiz.id), {
            code: 'NOT_FOUND',
          });
          assert.equal(
            (await learning.course(f.course.id)).progress.requiredItems,
            4,
          );
          await db.academicActivity.update({
            where: { itemId: f.quiz.id },
            data: { published: true },
          });
          await db.user.update({
            where: { id: A.id },
            data: { lmsAccessOverride: 'DISABLED' },
          });
          await assert.rejects(repo.attempts.view(f.course.id, f.quiz.id));
          await assert.rejects(
            repo.assignments.view(f.course.id, f.assignment.id),
          );
          await assert.rejects(repo.attendance(), { code: 'FORBIDDEN' });
          assert.equal((await repo.certificates()).length, 0);
          await db.user.update({
            where: { id: A.id },
            data: { lmsAccessOverride: 'ENABLED' },
          });
          await db.enrollment.delete({
            where: { userId_courseId: { userId: A.id, courseId: f.course.id } },
          });
          await assert.rejects(repo.attempts.start(f.course.id, f.quiz.id), {
            code: 'NOT_FOUND',
          });
          await assert.rejects(
            repo.assignments.submit(f.course.id, f.assignment.id, {
              requestKey: randomUUID(),
              kind: 'TEXT',
              text: 'late',
            }),
            { code: 'NOT_FOUND' },
          );
        },
      );
    } finally {
      if (old === undefined) delete process.env.LMS_SUBMISSIONS_ROOT;
      else process.env.LMS_SUBMISSIONS_ROOT = old;
      if (oldMedia === undefined) delete process.env.LMS_FILES_ROOT;
      else process.env.LMS_FILES_ROOT = oldMedia;
      await isolated.cleanup();
      await rm(root, { recursive: true, force: true });
    }
  },
);
