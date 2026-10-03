import 'server-only';
import { AcademicCore } from '../academic/core';
import { StudentError, errorMessages } from '../../student/errors';
import { requireAdminPermission } from '../../auth/admin-policy';
import { parseInput } from '../validation';
import {
  reviewInput,
  certificateInput,
  attendanceInput,
  assignmentReviewInput,
} from './validation';
import { completionProjection, evaluateCompletion } from '../../lms/completion';
import { AcademicStaff } from '../../lms/academic-staff';
export class AdminLearningOperations extends AcademicCore {
  async review(attemptId: string, input: unknown) {
    const c = parseInput(reviewInput, input);
    return this.write('AcademicResponseReviewed', async (tx) => {
      const a = await tx.academicAttempt.findFirst({
        where: {
          id: attemptId,
          userId: c.userId,
          activityId: c.itemId,
          activity: { item: { section: { courseId: c.courseId } } },
        },
        include: { responses: { include: { review: true } } },
      });
      if (!a) throw new StudentError('NOT_FOUND');
      const response = a.responses.find((r) => r.id === c.responseId);
      if (
        a.status !== 'SUBMITTED' ||
        !response ||
        !['SHORT_TEXT', 'LONG_TEXT'].includes(response.type) ||
        !response.requiresReview
      )
        throw new StudentError('CONFLICT');
      if (c.awardedPoints > response.points)
        throw new StudentError('INVALID_INPUT');
      const before = response.review;
      await tx.academicResponseReview.upsert({
        where: { responseId: response.id },
        create: {
          responseId: response.id,
          reviewerId: this.actorId,
          awardedPoints: c.awardedPoints,
          feedback: c.feedback,
        },
        update: {
          reviewerId: this.actorId,
          awardedPoints: c.awardedPoints,
          feedback: c.feedback,
          reviewedAt: new Date(),
        },
      });
      const rows = await tx.academicResponse.findMany({
        where: { attemptId },
        include: { review: true },
      });
      const maxScore = rows.reduce((n, r) => n + r.points, 0),
        score = rows.reduce(
          (n, r) => n + (r.review?.awardedPoints ?? r.awardedPoints ?? 0),
          0,
        ),
        pending = rows.some((r) => r.requiresReview && !r.review),
        percentage = (score * 100) / maxScore;
      await tx.academicAttempt.update({
        where: { id: attemptId },
        data: {
          score,
          maxScore,
          percentage,
          requiresReview: pending,
          passed:
            a.passingPercent === null
              ? null
              : pending
                ? null
                : percentage >= a.passingPercent,
        },
      });
      await evaluateCompletion(tx, a.userId, c.courseId);
      return {
        value: response.id,
        targetId: response.id,
        details: {
          attemptId,
          userId: a.userId,
          courseId: c.courseId,
          created: !before,
          beforePoints: before?.awardedPoints ?? null,
          afterPoints: c.awardedPoints,
          beforeReviewer: before?.reviewerId ?? null,
          afterReviewer: this.actorId,
          feedbackChanged: before?.feedback !== c.feedback,
          reviewPending: pending,
        },
      };
    });
  }
  async issue(userId: string, courseId: string) {
    return this.write('CertificatePolicyIssue', async (tx) => {
      const p = await completionProjection(tx, userId, courseId);
      if (!p?.projected.completion.certificateEligible)
        throw new StudentError('CONFLICT');
      const before = await tx.certificate.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (before?.status === 'REVOKED' || before?.adminSuspended)
        throw new StudentError('CONFLICT');
      await evaluateCompletion(tx, userId, courseId);
      const after = await tx.certificate.findUniqueOrThrow({
        where: { userId_courseId: { userId, courseId } },
      });
      return {
        value: after.id,
        targetId: after.id,
        details: {
          userId,
          courseId,
          beforeStatus: before?.status ?? null,
          afterStatus: after.status,
          policyChecked: true,
        },
      };
    });
  }
  async certificate(certificateId: string, input: unknown) {
    const c = parseInput(certificateInput, input);
    return this.write(`CertificateAdmin${c.action}`, async (tx) => {
      const before = await tx.certificate.findUnique({
        where: { id: certificateId },
      });
      if (!before) throw new StudentError('NOT_FOUND');
      if (before.status === 'REVOKED') throw new StudentError('CONFLICT');
      if (c.action === 'SUSPEND')
        await tx.certificate.update({
          where: { id: certificateId },
          data: { adminSuspended: true, status: 'SUSPENDED' },
        });
      else if (c.action === 'REVOKE')
        await tx.certificate.update({
          where: { id: certificateId },
          data: { adminSuspended: false, status: 'REVOKED' },
        });
      else {
        await tx.certificate.update({
          where: { id: certificateId },
          data: { adminSuspended: false, status: 'SUSPENDED' },
        });
        await evaluateCompletion(tx, before.userId, before.courseId);
      }
      const after = await tx.certificate.findUniqueOrThrow({
        where: { id: certificateId },
      });
      return {
        value: certificateId,
        targetId: certificateId,
        details: {
          reason: c.reason,
          beforeStatus: before.status,
          afterStatus: after.status,
          beforeHold: before.adminSuspended,
          afterHold: after.adminSuspended,
          userId: before.userId,
          courseId: before.courseId,
        },
      };
    });
  }
  async attendance(sessionId: string, input: unknown) {
    const c = parseInput(attendanceInput, input);
    await this.authorize('ATTENDANCE_MANAGE');
    const results = [];
    for (const row of c.rows) {
      try {
        await new AcademicStaff(this.db, this.actorId).attendance(
          sessionId,
          row.membershipId,
          row.status,
          { adminOnly: true, userId: row.userId, reason: row.reason },
        );
        results.push({ userId: row.userId, saved: true, error: null });
      } catch (error) {
        if (!(error instanceof StudentError)) throw error;
        results.push({
          userId: row.userId,
          saved: false,
          error: errorMessages[error.code],
        });
      }
    }
    return results;
  }
  async assignment(versionId: string, input: unknown) {
    const c = parseInput(assignmentReviewInput, input);
    await requireAdminPermission(this.db, this.actorId, 'ACADEMICS_MANAGE');
    if (c.versionId !== versionId) throw new StudentError('NOT_FOUND');
    await new AcademicStaff(this.db, this.actorId).review(
      versionId,
      c.status,
      c.feedback,
      undefined,
      {
        adminOnly: true,
        userId: c.userId,
        courseId: c.courseId,
        itemId: c.itemId,
      },
    );
  }
}
