import { z } from 'zod';
export const academicId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const answerInput = z
  .object({
    questionId: academicId,
    optionIds: z.array(academicId).max(30).optional(),
    text: z.string().max(12000).optional(),
  })
  .strict();
export const answersInput = z
  .object({ answers: z.array(answerInput).max(100) })
  .strict();
export const submissionInput = z
  .object({
    requestKey: z.string().uuid(),
    kind: z.enum(['TEXT', 'FILE', 'TEXT_AND_FILE']),
    text: z.string().max(12000).optional(),
  })
  .strict();
export function exactMatch(
  selected: readonly string[],
  correct: readonly string[],
) {
  return (
    new Set(selected).size === selected.length &&
    selected.length === correct.length &&
    correct.every((id) => selected.includes(id))
  );
}
export type CompletionSource =
  | 'LESSON_MANUAL'
  | 'QUIZ_SUBMITTED'
  | 'QUIZ_PASSED'
  | 'ASSESSMENT_SUBMITTED'
  | 'ASSESSMENT_PASSED'
  | 'ASSIGNMENT_SUBMITTED'
  | 'ASSIGNMENT_ACCEPTED';
export interface ItemCompletion {
  eligible: boolean;
  complete: boolean;
  source: CompletionSource | null;
  completedAt: string | null;
}
export function academicCompletion(
  kind: 'QUIZ' | 'ASSESSMENT',
  published: boolean,
  configured: boolean,
  threshold: number | null,
  attempts: {
    submittedAt: Date | null;
    percentage: number | null;
    requiresReview: boolean;
  }[],
): ItemCompletion {
  const eligible = published && configured;
  const valid = eligible
    ? attempts.find(
        (a) =>
          a.submittedAt &&
          (threshold === null ||
            (!a.requiresReview &&
              a.percentage !== null &&
              a.percentage >= threshold)),
      )
    : null;
  return {
    eligible,
    complete: !!valid,
    source: threshold === null ? `${kind}_SUBMITTED` : `${kind}_PASSED`,
    completedAt: valid?.submittedAt?.toISOString() || null,
  };
}
export function assignmentCompletion(
  published: boolean,
  requiresAcceptance: boolean,
  current:
    | { status: string; submittedAt: Date; reviews: { reviewedAt: Date }[] }
    | undefined,
): ItemCompletion {
  const complete =
    published &&
    !!current &&
    (!requiresAcceptance || current.status === 'ACCEPTED');
  return {
    eligible: published,
    complete,
    source: requiresAcceptance ? 'ASSIGNMENT_ACCEPTED' : 'ASSIGNMENT_SUBMITTED',
    completedAt: complete
      ? (requiresAcceptance
          ? current!.reviews[0]?.reviewedAt || current!.submittedAt
          : current!.submittedAt
        ).toISOString()
      : null,
  };
}
