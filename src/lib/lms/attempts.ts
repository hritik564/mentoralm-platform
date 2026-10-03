import 'server-only';
import { learningEvent } from './events';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { studentItem } from './academic-access';
import { answersInput, exactMatch } from './academic-rules';
import { academicTransaction, evaluateCompletion } from './completion';
const responsesInclude = {
  responses: {
    orderBy: { position: 'asc' as const },
    include: {
      options: { orderBy: { position: 'asc' as const } },
      review: true,
    },
  },
};
type Attempt = Prisma.AcademicAttemptGetPayload<{
  include: typeof responsesInclude;
}>;
function studentAttempt(a: Attempt) {
  const submitted = a.status === 'SUBMITTED',
    review = submitted && a.reviewAnswers;
  return {
    id: a.id,
    number: a.number,
    status: a.status,
    startedAt: a.startedAt.toISOString(),
    submittedAt: a.submittedAt?.toISOString() || null,
    score: submitted ? a.score : null,
    maxScore: submitted ? a.maxScore : null,
    percentage: submitted ? a.percentage : null,
    passed: submitted ? a.passed : null,
    requiresReview: submitted && a.requiresReview,
    questions: a.responses.map((q) => ({
      id: q.questionId,
      type: q.type,
      prompt: q.prompt,
      position: q.position,
      points: q.points,
      text: q.text || '',
      optionIds: q.options.filter((o) => o.selected).map((o) => o.optionId),
      options: q.options.map((o) => ({
        id: o.optionId,
        label: o.label,
        ...(review ? { correct: o.correct } : {}),
      })),
      ...(review
        ? {
            explanation: q.explanation,
            awardedPoints: q.review?.awardedPoints ?? q.awardedPoints,
            feedback: q.review?.feedback ?? null,
            requiresReview: q.requiresReview && !q.review,
          }
        : {}),
    })),
  };
}
export class Attempts {
  constructor(
    private db: PrismaClient,
    private userId: string,
  ) {}
  private async activity(
    db: Prisma.TransactionClient,
    courseId: string,
    itemId: string,
  ) {
    const item = await studentItem(db, this.userId, courseId, itemId);
    if (!['QUIZ', 'ASSESSMENT'].includes(item.type))
      throw new StudentError('NOT_FOUND');
    const a = await db.academicActivity.findFirst({
      where: { itemId, published: true },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: {
            question: {
              include: { options: { orderBy: { position: 'asc' } } },
            },
          },
        },
      },
    });
    if (
      !a ||
      !a.questions.length ||
      a.questions.length > 100 ||
      a.questions.some((q) => !q.question.published)
    )
      throw new StudentError('NOT_FOUND');
    return { ...a, title: item.title };
  }
  async view(courseId: string, itemId: string) {
    const a = await this.activity(this.db, courseId, itemId);
    const attempts = await this.db.academicAttempt.findMany({
      where: { activityId: itemId, userId: this.userId },
      orderBy: { number: 'desc' },
      include: responsesInclude,
      take: 100,
    });
    return {
      id: itemId,
      title: a.title,
      kind: a.itemType,
      instructions: a.instructions,
      passingPercent: a.passingPercent,
      attemptLimit: a.attemptLimit,
      canStart: !a.attemptLimit || attempts.length < a.attemptLimit,
      attempts: attempts.map(studentAttempt),
    };
  }
  async start(courseId: string, itemId: string) {
    return academicTransaction(this.db, async (db) => {
      const a = await this.activity(db, courseId, itemId);
      const open = await db.academicAttempt.findFirst({
        where: {
          activityId: itemId,
          userId: this.userId,
          status: 'IN_PROGRESS',
        },
        include: responsesInclude,
      });
      if (open) return studentAttempt(open);
      const count = await db.academicAttempt.count({
        where: { activityId: itemId, userId: this.userId },
      });
      if (count >= (a.attemptLimit || 100)) throw new StudentError('FORBIDDEN');
      for (const { question: q } of a.questions) {
        const choice = [
          'SINGLE_CHOICE',
          'MULTIPLE_CHOICE',
          'TRUE_FALSE',
        ].includes(q.type);
        if (
          choice &&
          (q.options.length < 2 ||
            q.options.length > 30 ||
            !q.options.some((o) => o.correct) ||
            (q.type !== 'MULTIPLE_CHOICE' &&
              q.options.filter((o) => o.correct).length !== 1) ||
            (q.type === 'TRUE_FALSE' && q.options.length !== 2))
        )
          throw new StudentError('UNAVAILABLE');
      }
      const attempt = await db.academicAttempt.create({
        data: {
          userId: this.userId,
          activityId: itemId,
          number: count + 1,
          passingPercent: a.passingPercent,
          reviewAnswers: a.reviewAnswers,
          responses: {
            create: a.questions.map(({ question: q, position, points }) => ({
              questionId: q.id,
              type: q.type,
              prompt: q.prompt,
              explanation: q.explanation,
              position,
              points,
              options: {
                create: q.options.map((o) => ({
                  optionId: o.id,
                  label: o.label,
                  position: o.position,
                  correct: o.correct,
                })),
              },
            })),
          },
        },
        include: responsesInclude,
      });
      return studentAttempt(attempt);
    });
  }
  private async own(
    db: Prisma.TransactionClient,
    courseId: string,
    itemId: string,
    attemptId: string,
  ) {
    const activity = await this.activity(db, courseId, itemId);
    const a = await db.academicAttempt.findFirst({
      where: { id: attemptId, userId: this.userId, activityId: itemId },
      include: responsesInclude,
    });
    if (!a) throw new StudentError('NOT_FOUND');
    return { ...a, itemType: activity.itemType };
  }
  async save(
    courseId: string,
    itemId: string,
    attemptId: string,
    input: unknown,
  ) {
    const parsed = answersInput.safeParse(input);
    if (
      !parsed.success ||
      new Set(parsed.data.answers.map((a) => a.questionId)).size !==
        parsed.data.answers.length
    )
      throw new StudentError('INVALID_INPUT');
    return academicTransaction(this.db, async (db) => {
      const a = await this.own(db, courseId, itemId, attemptId);
      if (a.status !== 'IN_PROGRESS') throw new StudentError('FORBIDDEN');
      for (const answer of parsed.data.answers) {
        const q = a.responses.find((r) => r.questionId === answer.questionId);
        if (!q) throw new StudentError('INVALID_INPUT');
        const choice = [
          'SINGLE_CHOICE',
          'MULTIPLE_CHOICE',
          'TRUE_FALSE',
        ].includes(q.type);
        const ids = answer.optionIds || [];
        if (
          choice
            ? answer.text !== undefined ||
              new Set(ids).size !== ids.length ||
              ids.some((id) => !q.options.some((o) => o.optionId === id)) ||
              (q.type !== 'MULTIPLE_CHOICE' && ids.length > 1)
            : answer.optionIds !== undefined
        )
          throw new StudentError('INVALID_INPUT');
        await db.academicResponse.update({
          where: { id: q.id },
          data: { text: choice ? null : answer.text || null },
        });
        await db.responseOption.updateMany({
          where: { responseId: q.id },
          data: { selected: false },
        });
        if (ids.length)
          await db.responseOption.updateMany({
            where: { responseId: q.id, optionId: { in: ids } },
            data: { selected: true },
          });
      }
      const updated = await db.academicAttempt.update({
        where: { id: a.id },
        data: { lastSavedAt: new Date() },
        include: responsesInclude,
      });
      return studentAttempt(updated);
    });
  }
  async submit(courseId: string, itemId: string, attemptId: string) {
    return academicTransaction(this.db, async (db) => {
      const a = await this.own(db, courseId, itemId, attemptId);
      if (a.status === 'SUBMITTED') return studentAttempt(a);
      let score = 0,
        maxScore = 0,
        requiresReview = false;
      for (const q of a.responses) {
        const choice = [
          'SINGLE_CHOICE',
          'MULTIPLE_CHOICE',
          'TRUE_FALSE',
        ].includes(q.type);
        const selected = q.options
          .filter((o) => o.selected)
          .map((o) => o.optionId);
        if (choice ? !selected.length : !q.text?.trim())
          throw new StudentError('INVALID_INPUT');
        const awarded = choice
          ? exactMatch(
              selected,
              q.options.filter((o) => o.correct).map((o) => o.optionId),
            )
            ? q.points
            : 0
          : null;
        maxScore += q.points;
        score += awarded || 0;
        requiresReview ||= !choice;
        await db.academicResponse.update({
          where: { id: q.id },
          data: { awardedPoints: awarded, requiresReview: !choice },
        });
      }
      const percentage = (score / maxScore) * 100;
      const updated = await db.academicAttempt.update({
        where: { id: a.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          score,
          maxScore,
          percentage,
          requiresReview,
          passed:
            a.passingPercent === null
              ? null
              : requiresReview
                ? null
                : percentage >= a.passingPercent,
        },
        include: responsesInclude,
      });
      await learningEvent(db, {
        kind:
          a.itemType === 'ASSESSMENT'
            ? 'AssessmentResultAvailable'
            : 'QuizResultAvailable',
        key: `result:${attemptId}`,
        subjectId: attemptId,
        courseId,
        userId: this.userId,
      });
      await evaluateCompletion(db, this.userId, courseId);
      return studentAttempt(updated);
    });
  }
}
