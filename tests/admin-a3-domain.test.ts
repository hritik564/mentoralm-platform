import { legacyAdminPermissions } from '../src/lib/admin/permissions';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Assignments } from '../src/lib/lms/assignments';
import { Discussions } from '../src/lib/lms/discussions';
import { StudentRepository } from '../src/lib/student/repository';
import { BatchCommunications } from '../src/lib/lms/communications';
import { AdminOperationalRepository } from '../src/lib/admin/operational/read';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase } from './helpers/d4-database';
import { academicFixture } from './helpers/l3-fixtures';
import { AdminLearningOperations } from '../src/lib/admin/operational/learning';
import { Attempts } from '../src/lib/lms/attempts';
import { LearningRepository } from '../src/lib/lms/learning';
import {
  academicTransaction,
  evaluateCompletion,
} from '../src/lib/lms/completion';
test('A3 approved academic review and certificate state invariants', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db;
  try {
    const admin = await db.user.create({
      data: { clerkUserId: 'a3_admin', role: 'STUDENT' },
    });
    await db.userRoleAssignment.create({
      data: { userId: admin.id, role: 'ADMIN' },
    });
    await db.adminAuthorization.create({
      data: { userId: admin.id, permissions: legacyAdminPermissions },
    });
    const student = await db.user.create({
        data: { clerkUserId: 'a3_student', lmsAccessOverride: 'ENABLED' },
      }),
      other = await db.user.create({
        data: { clerkUserId: 'a3_other', lmsAccessOverride: 'ENABLED' },
      });
    const x = await academicFixture(db, student.id, 'a3inv');
    await db.learningItem.updateMany({
      where: { sectionId: x.section.id, type: { not: 'LESSON' } },
      data: { required: false },
    });
    await db.academicActivity.update({
      where: { itemId: x.assessment.id },
      data: { passingPercent: 100, reviewAnswers: true },
    });
    const learner = new LearningRepository(db, student),
      attempts = new Attempts(db, student.id),
      ops = new AdminLearningOperations(db, admin.id),
      denied = new AdminLearningOperations(db, student.id);
    const attempt = await attempts.start(x.course.id, x.assessment.id);
    await attempts.save(x.course.id, x.assessment.id, attempt.id, {
      answers: [
        { questionId: x.single.id, optionIds: [x.single.options[0].id] },
        { questionId: x.short.id, text: 'Short original response' },
        { questionId: x.long.id, text: 'Long original response' },
      ],
    });
    await attempts.submit(x.course.id, x.assessment.id, attempt.id);
    const responses = await db.academicResponse.findMany({
        where: { attemptId: attempt.id },
        orderBy: { position: 'asc' },
        include: { options: true },
      }),
      frozen = JSON.stringify(responses),
      short = responses[1],
      long = responses[2],
      objective = responses[0];
    const context = {
      courseId: x.course.id,
      itemId: x.assessment.id,
      userId: student.id,
      responseId: short.id,
      awardedPoints: 1,
      feedback: 'Well supported.',
    };
    await t.test(
      '1 Submitted response remains byte-for-byte unchanged after SHORT_TEXT review',
      async () => {
        await ops.review(attempt.id, context);
        assert.equal(
          JSON.stringify(
            await db.academicResponse.findMany({
              where: { attemptId: attempt.id },
              orderBy: { position: 'asc' },
              include: { options: true },
            }),
          ),
          frozen,
        );
      },
    );
    await t.test(
      '2 Incomplete human reviews keep attempt pending',
      async () => {
        assert.equal(
          (
            await db.academicAttempt.findUniqueOrThrow({
              where: { id: attempt.id },
            })
          ).requiresReview,
          true,
        );
      },
    );
    await t.test('3 LONG_TEXT review completes effective scoring', async () => {
      await ops.review(attempt.id, { ...context, responseId: long.id });
      const a = await db.academicAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      assert.equal(a.requiresReview, false);
      assert.equal(a.percentage, 100);
      assert.equal(a.passed, true);
    });
    await t.test('4 Objective responses cannot be overridden', async () => {
      await assert.rejects(
        ops.review(attempt.id, {
          ...context,
          responseId: objective.id,
          awardedPoints: 0,
        }),
        { code: 'CONFLICT' },
      );
      assert.equal(
        (
          await db.academicResponse.findUniqueOrThrow({
            where: { id: objective.id },
          })
        ).awardedPoints,
        1,
      );
    });
    await t.test('5 Points below zero rejected', async () => {
      await assert.rejects(
        ops.review(attempt.id, { ...context, awardedPoints: -1 }),
        { code: 'INVALID_INPUT' },
      );
    });
    await t.test(
      '6 Points above snapshot rejected despite later authoring change',
      async () => {
        await db.activityQuestion.update({
          where: {
            activityId_questionId: {
              activityId: x.assessment.id,
              questionId: x.short.id,
            },
          },
          data: { points: 100 },
        });
        await assert.rejects(
          ops.review(attempt.id, { ...context, awardedPoints: 2 }),
          { code: 'INVALID_INPUT' },
        );
      },
    );
    await t.test('7 Non-Admin cannot review', async () => {
      await assert.rejects(denied.review(attempt.id, context), {
        code: 'FORBIDDEN',
      });
    });
    await t.test(
      '8 Cross-Student and wrong Course/item context rejected',
      async () => {
        for (const change of [
          { userId: other.id },
          { courseId: 'another_course' },
          { itemId: x.optional.id },
        ])
          await assert.rejects(
            ops.review(attempt.id, { ...context, ...change }),
            { code: 'NOT_FOUND' },
          );
      },
    );
    await t.test('9 Cross-attempt response rejected', async () => {
      const second = await attempts.start(x.course.id, x.optional.id);
      const r = await db.academicResponse.findFirstOrThrow({
        where: { attemptId: second.id },
      });
      await assert.rejects(
        ops.review(attempt.id, { ...context, responseId: r.id }),
        { code: 'CONFLICT' },
      );
    });
    await t.test('10 Correction deterministic and audited', async () => {
      await ops.review(attempt.id, {
        ...context,
        awardedPoints: 0,
        feedback: 'Corrected evaluation.',
      });
      const a = await db.academicAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      assert.equal(a.score, 2);
      assert.equal(a.maxScore, 3);
      assert.equal(a.passed, false);
      assert.equal(
        await db.academicResponseReview.count({
          where: { responseId: short.id },
        }),
        1,
      );
      const audit = await db.academicAudit.findMany({
        where: { action: 'AcademicResponseReviewed', targetId: short.id },
        orderBy: { createdAt: 'desc' },
      });
      assert.equal(audit.length, 2);
      assert.equal(
        (audit[0].details as { beforePoints: number }).beforePoints,
        1,
      );
      assert.ok(!JSON.stringify(audit).includes('Short original response'));
    });
    await t.test(
      '11 Snapshots and submitted attempt history unchanged',
      async () => {
        assert.equal(
          JSON.stringify(
            await db.academicResponse.findMany({
              where: { attemptId: attempt.id },
              orderBy: { position: 'asc' },
              include: { options: true },
            }),
          ),
          frozen,
        );
        const a = await db.academicAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        });
        assert.equal(a.number, 1);
        assert.equal(a.status, 'SUBMITTED');
        assert.equal(a.passingPercent, 100);
      },
    );
    await t.test(
      '12 Student result uses effective review without leaking before review policy',
      async () => {
        const a = (
          await attempts.view(x.course.id, x.assessment.id)
        ).attempts.find((a) => a.id === attempt.id)!;
        assert.equal(a.questions[1].awardedPoints, 0);
        assert.equal(a.questions[1].requiresReview, false);
        assert.equal(a.questions[1].feedback, 'Corrected evaluation.');
      },
    );
    await learner.record(x.course.id, x.lesson.id, true);
    const cert = await db.certificate.findUniqueOrThrow({
        where: {
          userId_courseId: { userId: student.id, courseId: x.course.id },
        },
      }),
      enrollmentBefore = await db.enrollment.findUniqueOrThrow({
        where: {
          userId_courseId: { userId: student.id, courseId: x.course.id },
        },
      });
    await t.test('13 Existing/new certificate defaults false', async () => {
      assert.equal(cert.adminSuspended, false);
      assert.equal(cert.status, 'ACTIVE');
    });
    await t.test(
      '14 Eligible ACTIVE certificate can be suspended',
      async () => {
        await ops.certificate(cert.id, {
          action: 'SUSPEND',
          reason: 'Owner review hold',
        });
        const c = await db.certificate.findUniqueOrThrow({
          where: { id: cert.id },
        });
        assert.equal(c.status, 'SUSPENDED');
        assert.equal(c.adminSuspended, true);
      },
    );
    await t.test(
      '15-16 Administrative hold survives normal eligibility reconciliation',
      async () => {
        await academicTransaction(db, (tx) =>
          evaluateCompletion(tx, student.id, x.course.id),
        );
        const c = await db.certificate.findUniqueOrThrow({
          where: { id: cert.id },
        });
        assert.equal(c.adminSuspended, true);
        assert.equal(c.status, 'SUSPENDED');
      },
    );
    await t.test('17 Eligible restore clears hold and activates', async () => {
      await ops.certificate(cert.id, {
        action: 'RESTORE',
        reason: 'Hold released',
      });
      const c = await db.certificate.findUniqueOrThrow({
        where: { id: cert.id },
      });
      assert.equal(c.status, 'ACTIVE');
      assert.equal(c.adminSuspended, false);
    });
    await t.test(
      '18 Ineligible restore clears hold but remains non-active',
      async () => {
        await ops.certificate(cert.id, {
          action: 'SUSPEND',
          reason: 'Recheck',
        });
        await db.lessonState.update({
          where: { userId_itemId: { userId: student.id, itemId: x.lesson.id } },
          data: { completedAt: null },
        });
        await ops.certificate(cert.id, {
          action: 'RESTORE',
          reason: 'Release without eligibility bypass',
        });
        const c = await db.certificate.findUniqueOrThrow({
          where: { id: cert.id },
        });
        assert.equal(c.status, 'SUSPENDED');
        assert.equal(c.adminSuspended, false);
      },
    );
    await t.test(
      '19 Policy-only suspension recovers when eligible',
      async () => {
        await learner.record(x.course.id, x.lesson.id, true);
        assert.equal(
          (await db.certificate.findUniqueOrThrow({ where: { id: cert.id } }))
            .status,
          'ACTIVE',
        );
      },
    );
    await t.test('20 Revoke clears hold and remains terminal', async () => {
      await ops.certificate(cert.id, {
        action: 'SUSPEND',
        reason: 'Hold then revoke',
      });
      await ops.certificate(cert.id, {
        action: 'REVOKE',
        reason: 'Final revocation',
      });
      await academicTransaction(db, (tx) =>
        evaluateCompletion(tx, student.id, x.course.id),
      );
      const c = await db.certificate.findUniqueOrThrow({
        where: { id: cert.id },
      });
      assert.equal(c.status, 'REVOKED');
      assert.equal(c.adminSuspended, false);
    });
    await t.test('21 Restore cannot un-revoke', async () => {
      await assert.rejects(
        ops.certificate(cert.id, {
          action: 'RESTORE',
          reason: 'Cannot restore',
        }),
        { code: 'CONFLICT' },
      );
    });
    await t.test(
      '22 Non-Admin cannot change certificate hold/issue; history intact',
      async () => {
        await assert.rejects(
          denied.certificate(cert.id, { action: 'SUSPEND', reason: 'Attack' }),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(denied.issue(student.id, x.course.id), {
          code: 'FORBIDDEN',
        });
        const e = await db.enrollment.findUniqueOrThrow({
          where: { id: enrollmentBefore.id },
        });
        assert.equal(
          e.completedAt?.toISOString(),
          enrollmentBefore.completedAt?.toISOString(),
        );
        assert.equal(
          await db.certificate.count({
            where: { courseId: x.course.id, userId: student.id },
          }),
          1,
        );
      },
    );
  } finally {
    await f.cleanup();
  }
});

test('A3 operational authorization, attendance, immutable assignments, private files, Support, moderation, consent and referrals', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db,
    root = await mkdtemp(join(tmpdir(), 'a3-submissions-')),
    previous = process.env.LMS_SUBMISSIONS_ROOT;
  process.env.LMS_SUBMISSIONS_ROOT = root;
  try {
    const admin = await db.user.create({
      data: { clerkUserId: 'ops_admin', role: 'STUDENT' },
    });
    await db.userRoleAssignment.create({
      data: { userId: admin.id, role: 'ADMIN' },
    });
    await db.adminAuthorization.create({
      data: { userId: admin.id, permissions: legacyAdminPermissions },
    });
    const student = await db.user.create({
        data: { clerkUserId: 'ops_student', lmsAccessOverride: 'ENABLED' },
      }),
      other = await db.user.create({
        data: { clerkUserId: 'ops_other', lmsAccessOverride: 'ENABLED' },
      }),
      x = await academicFixture(db, student.id, 'a3ops');
    const directory = {
        search: async () => [student.clerkUserId],
        lookup: async (ids: string[]) =>
          new Map(
            ids.map((id) => [
              id,
              { name: id, email: '', phone: null, status: 'Active' as const },
            ]),
          ),
      },
      ops = new AdminOperationalRepository(db, admin.id, directory, f.schema),
      denied = new AdminOperationalRepository(
        db,
        student.id,
        directory,
        f.schema,
      );
    const otherBatch = await db.batch.create({
        data: { code: 'A3-OTHER', name: 'Other Batch' },
      }),
      otherMembership = await db.batchMembership.create({
        data: {
          batchId: otherBatch.id,
          userId: other.id,
          joinedAt: new Date('2020-01-01'),
        },
      });
    await t.test(
      'Attendance validates each row, rejects cross-Batch/Student and records correction audit',
      async () => {
        const results = await ops.attendance(x.session.id, {
          rows: [
            {
              membershipId: x.membership.id,
              userId: student.id,
              status: 'ABSENT',
              reason: 'Original missed session',
            },
            {
              membershipId: otherMembership.id,
              userId: other.id,
              status: 'PRESENT',
              reason: 'Invalid roster',
            },
          ],
        });
        assert.equal(results[0].saved, true);
        assert.equal(results[1].saved, false);
        assert.equal(await db.attendanceRecord.count(), 1);
        await ops.attendance(x.session.id, {
          rows: [
            {
              membershipId: x.membership.id,
              userId: student.id,
              status: 'LATE',
              reason: 'Arrival confirmed',
            },
          ],
        });
        const a = await db.academicAudit.findFirstOrThrow({
          where: { action: 'ATTENDANCE_ABSENT_TO_LATE' },
        });
        assert.equal(
          (a.details as { reason: string }).reason,
          'Arrival confirmed',
        );
        const wrong = await ops.attendance(x.session.id, {
          rows: [
            {
              membershipId: x.membership.id,
              userId: other.id,
              status: 'PRESENT',
              reason: 'Wrong Student',
            },
          ],
        });
        assert.equal(wrong[0].saved, false);
        await assert.rejects(
          denied.attendance(x.session.id, {
            rows: [
              {
                membershipId: x.membership.id,
                userId: student.id,
                status: 'PRESENT',
                reason: 'Attack',
              },
            ],
          }),
          { code: 'FORBIDDEN' },
        );
        const roster = await ops.session(x.session.id);
        assert.equal(roster.total, 1);
        assert.equal(roster.rows[0].status, 'LATE');
      },
    );
    const assignments = new Assignments(db, student.id),
      first = await assignments.submit(
        x.course.id,
        x.assignment.id,
        {
          requestKey: randomUUID(),
          kind: 'TEXT_AND_FILE',
          text: 'Immutable original work',
        },
        [new File(['Private notes'], 'notes.txt', { type: 'text/plain' })],
      ),
      versionBefore = await db.submissionVersion.findUniqueOrThrow({
        where: { id: first.id },
      }),
      submission = await db.assignmentSubmission.findFirstOrThrow({
        where: { userId: student.id, assignmentId: x.assignment.id },
      }),
      file = await db.submissionFile.findFirstOrThrow({
        where: { versionId: first.id },
      });
    await t.test(
      'Assignment review preserves content/files and has correct latest-version queue',
      async () => {
        await ops.assignment(first.id, {
          versionId: first.id,
          userId: student.id,
          courseId: x.course.id,
          itemId: x.assignment.id,
          status: 'CHANGES_REQUESTED',
          feedback: 'Explain your rationale.',
        });
        const second = await assignments.submit(x.course.id, x.assignment.id, {
          requestKey: randomUUID(),
          kind: 'TEXT',
          text: 'Second immutable work',
        });
        await assert.rejects(
          ops.assignment(first.id, {
            versionId: first.id,
            userId: student.id,
            courseId: x.course.id,
            itemId: x.assignment.id,
            status: 'ACCEPTED',
            feedback: 'Stale review',
          }),
          { code: 'FORBIDDEN' },
        );
        const queue = await ops.list('submissions', { status: 'SUBMITTED' });
        assert.equal(queue.total, 1);
        const recent = await ops.list('submissions', {
          status: 'CHANGES_REQUESTED',
        });
        assert.equal(recent.total, 0);
        await ops.assignment(second.id, {
          versionId: second.id,
          userId: student.id,
          courseId: x.course.id,
          itemId: x.assignment.id,
          status: 'ACCEPTED',
          feedback: 'Accepted latest version.',
        });
        const old = await db.submissionVersion.findUniqueOrThrow({
          where: { id: first.id },
        });
        assert.equal(old.text, versionBefore.text);
        assert.equal(old.number, versionBefore.number);
        assert.equal(old.requestKey, versionBefore.requestKey);
        assert.equal(
          old.submittedAt.toISOString(),
          versionBefore.submittedAt.toISOString(),
        );
        assert.deepEqual(
          await db.submissionFile.findUniqueOrThrow({ where: { id: file.id } }),
          file,
        );
        await assert.rejects(
          denied.assignment(second.id, {
            versionId: second.id,
            userId: student.id,
            courseId: x.course.id,
            itemId: x.assignment.id,
            status: 'ACCEPTED',
            feedback: 'Attack',
          }),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(
          ops.assignment(second.id, {
            versionId: second.id,
            userId: other.id,
            courseId: x.course.id,
            itemId: x.assignment.id,
            status: 'ACCEPTED',
            feedback: 'IDOR',
          }),
          { code: 'NOT_FOUND' },
        );
      },
    );
    await t.test(
      'Private file parent and role authorization preserved, no key in detail DTO',
      async () => {
        assert.ok((await ops.file(submission.id, file.id)).storageKey);
        await assert.rejects(denied.file(submission.id, file.id), {
          code: 'FORBIDDEN',
        });
        await assert.rejects(ops.file('wrong_submission', file.id), {
          code: 'NOT_FOUND',
        });
        assert.ok(
          !JSON.stringify(await ops.submission(submission.id)).includes(
            file.storageKey,
          ),
        );
        await assert.rejects(
          new Assignments(db, other.id).file(
            x.course.id,
            x.assignment.id,
            file.id,
          ),
        );
      },
    );
    const discussions = new Discussions(db, student.id),
      thread = await discussions.create({
        courseId: x.course.id,
        batchId: x.batch.id,
        title: 'Original thread',
        body: 'Original student content',
      }),
      postBefore = await db.discussionPost.findFirstOrThrow({
        where: { threadId: thread.id },
      });
    await t.test(
      'Moderation locks/unlocks without changing Student content or author',
      async () => {
        await ops.moderate(thread.id, {
          locked: true,
          reason: 'Review thread conduct',
        });
        await assert.rejects(
          discussions.reply(thread.id, { body: 'Locked reply' }),
          { code: 'CONFLICT' },
        );
        assert.deepEqual(
          await db.discussionPost.findUniqueOrThrow({
            where: { id: postBefore.id },
          }),
          postBefore,
        );
        await assert.rejects(
          denied.moderate(thread.id, { locked: false, reason: 'Attack' }),
          { code: 'FORBIDDEN' },
        );
        await ops.moderate(thread.id, {
          locked: false,
          reason: 'Reopen discussion',
        });
        await discussions.reply(thread.id, { body: 'Allowed reply' });
      },
    );
    const studentRepo = new StudentRepository(db, student),
      otherRepo = new StudentRepository(db, other),
      ticket = await studentRepo.createTicket({
        category: 'Technical',
        subject: 'Local issue',
        message: 'Original ticket message',
      });
    await t.test(
      'Admin Support reply uses server actor and preserves Student ownership/closed policy',
      async () => {
        await ops.support(ticket.id, {
          status: 'IN_PROGRESS',
          body: 'Admin assistance',
        });
        const m = await db.supportMessage.findFirstOrThrow({
          where: { ticketId: ticket.id, actor: 'STAFF' },
        });
        assert.equal(m.senderId, admin.id);
        await assert.rejects(otherRepo.ticket(ticket.id), {
          code: 'NOT_FOUND',
        });
        await assert.rejects(
          denied.support(ticket.id, { status: 'CLOSED', body: null }),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(
          ops.support(ticket.id, {
            status: 'OPEN',
            body: 'Spoof',
            actorId: student.id,
          }),
          { code: 'INVALID_INPUT' },
        );
        await ops.support(ticket.id, { status: 'CLOSED', body: null });
        await assert.rejects(
          studentRepo.reply(ticket.id, { message: 'Closed reply' }),
          { code: 'CONFLICT' },
        );
        assert.equal((await ops.ticket(ticket.id)).status, 'CLOSED');
      },
    );
    await t.test(
      'Communication audience and permissions resolved server-side, no SENT state',
      async () => {
        const params = {
          batchId: x.batch.id,
          channel: 'EMAIL' as const,
          purpose: 'MARKETING' as const,
        };
        assert.deepEqual(await ops.audience(params), {
          total: 1,
          pendingProvider: 0,
          suppressed: 1,
          provider: 'UNCONFIGURED',
        });
        const message = await ops.plan({
          ...params,
          subject: 'Planning only',
          body: 'No actual sends',
        });
        const delivery = await db.communicationDelivery.findFirstOrThrow({
          where: { messageId: message.id },
        });
        assert.equal(delivery.status, 'SUPPRESSED');
        await new BatchCommunications(db, admin.id).preference(
          student.id,
          'EMAIL',
          'MARKETING',
          true,
          'Explicit test consent',
        );
        assert.equal((await ops.audience(params)).pendingProvider, 1);
        const allowed = await ops.plan({
          ...params,
          subject: 'Permission confirmed',
          body: 'Still not sent',
        });
        assert.equal(
          (
            await db.communicationDelivery.findFirstOrThrow({
              where: { messageId: allowed.id },
            })
          ).status,
          'PENDING_PROVIDER',
        );
        await assert.rejects(
          ops.plan({
            ...params,
            subject: 'Spoof',
            body: 'Bad',
            recipients: [other.id],
          }),
          { code: 'INVALID_INPUT' },
        );
        await assert.rejects(
          denied.plan({ ...params, subject: 'Attack', body: 'Denied' }),
          { code: 'FORBIDDEN' },
        );
      },
    );
    await db.referralIdentity.create({
      data: { userId: student.id, code: 'A3-REFERRAL' },
    });
    await db.referralAttribution.create({
      data: { referrerId: student.id, referredUserId: other.id },
    });
    await t.test(
      'Referral read is privileged and history unchanged; all operations audited without bodies',
      async () => {
        const before = await db.referralAttribution.findMany();
        assert.equal((await ops.referral(student.id)).total, 1);
        assert.equal((await ops.list('referrals')).total, 1);
        await assert.rejects(denied.referral(student.id), {
          code: 'FORBIDDEN',
        });
        assert.deepEqual(await db.referralAttribution.findMany(), before);
        const audits = await db.academicAudit.findMany();
        for (const action of [
          'ASSIGNMENT_REVIEW',
          'DiscussionLockChanged',
          'SupportAdminAction',
          'COMMUNICATION_PLANNED',
        ])
          assert.ok(audits.some((a) => a.action === action));
        assert.ok(!JSON.stringify(audits).includes('Admin assistance'));
        assert.ok(!JSON.stringify(audits).includes('Immutable original work'));
        assert.equal((await ops.overview()).openSupport, 0);
        await db.userRoleAssignment.delete({
          where: { userId_role: { userId: admin.id, role: 'ADMIN' } },
        });
        await assert.rejects(ops.list('support'), { code: 'FORBIDDEN' });
      },
    );
  } finally {
    await f.cleanup();
    await rm(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.LMS_SUBMISSIONS_ROOT;
    else process.env.LMS_SUBMISSIONS_ROOT = previous;
  }
});

test('A3 simultaneous reviews and corrections reconcile one effective aggregate without lost updates', async () => {
  const f = await isolatedDatabase();
  try {
    const admin = await f.db.user.create({
        data: {
          clerkUserId: 'concurrent-a3-admin',
          role: 'ADMIN',
          adminAuthorization: {
            create: { permissions: legacyAdminPermissions },
          },
        },
      }),
      student = await f.db.user.create({
        data: {
          clerkUserId: 'concurrent-a3-student',
          lmsAccessOverride: 'ENABLED',
        },
      }),
      x = await academicFixture(f.db, student.id, 'a3concurrent'),
      attempts = new Attempts(f.db, student.id),
      ops = new AdminLearningOperations(f.db, admin.id),
      a = await attempts.start(x.course.id, x.assessment.id);
    await attempts.save(x.course.id, x.assessment.id, a.id, {
      answers: [
        { questionId: x.single.id, optionIds: [x.single.options[0].id] },
        { questionId: x.short.id, text: 'Original short response' },
        { questionId: x.long.id, text: 'Original long response' },
      ],
    });
    await attempts.submit(x.course.id, x.assessment.id, a.id);
    const before = await f.db.academicResponse.findMany({
      where: { attemptId: a.id },
      orderBy: { position: 'asc' },
      include: { options: true },
    });
    const review = (responseId: string, awardedPoints: number) =>
      ops.review(a.id, {
        courseId: x.course.id,
        itemId: x.assessment.id,
        userId: student.id,
        responseId,
        awardedPoints,
        feedback: null,
      });
    await Promise.all(
      before.filter((r) => r.requiresReview).map((r) => review(r.id, 1)),
    );
    let after = await f.db.academicAttempt.findUniqueOrThrow({
      where: { id: a.id },
    });
    assert.equal(after.score, 3);
    assert.equal(after.requiresReview, false);
    await Promise.all(
      before.filter((r) => r.requiresReview).map((r) => review(r.id, 0)),
    );
    after = await f.db.academicAttempt.findUniqueOrThrow({
      where: { id: a.id },
    });
    assert.equal(after.score, 1);
    assert.equal(after.requiresReview, false);
    assert.equal(await f.db.academicResponseReview.count(), 2);
    assert.equal(
      await f.db.academicAudit.count({
        where: { action: 'AcademicResponseReviewed' },
      }),
      4,
    );
    assert.deepEqual(
      await f.db.academicResponse.findMany({
        where: { attemptId: a.id },
        orderBy: { position: 'asc' },
        include: { options: true },
      }),
      before,
    );
  } finally {
    await f.cleanup();
  }
});
