import { z } from 'zod';
import { structuredLesson } from '../../lms/content';
export const text = (max = 160) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (v) =>
        !/[<>]/.test(v) &&
        [...v].every(
          (c) => c.charCodeAt(0) >= 32 || ['\n', '\r', '\t'].includes(c),
        ),
    );
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const programInput = z.object({ title: text() }).strict();
export const courseInput = z
  .object({
    title: text(),
    description: text(4000),
    programId: id.nullable(),
    thumbnailPath: z.enum([
      '/images/campus.webp',
      '/images/learner.webp',
      '/images/collaboration.webp',
      '/images/entrepreneurship.webp',
      '/images/counsellor.webp',
    ]),
    thumbnailAlt: text(),
    publicPath: z.literal('/#programs'),
    published: z.boolean(),
    academicCompletionEnabled: z.boolean(),
    certificateEnabled: z.boolean(),
    requiredAttendancePercent: z.number().min(0).max(100).nullable(),
  })
  .strict();
export const sectionInput = z
  .object({
    title: text(),
    description: text(2000).nullable(),
    published: z.boolean(),
  })
  .strict();
export const itemTypes = [
  'LESSON',
  'QUIZ',
  'ASSIGNMENT',
  'RESOURCE',
  'LIVE_SESSION',
  'ASSESSMENT',
] as const;
export const itemInput = z
  .object({
    title: text(),
    type: z.enum(itemTypes),
    required: z.boolean(),
    published: z.boolean(),
  })
  .strict();
export const orderInput = z
  .object({ direction: z.enum(['UP', 'DOWN']) })
  .strict();
export const deleteInput = z.object({ confirm: z.literal(true) }).strict();
export const lessonInput = z.discriminatedUnion('format', [
  z
    .object({
      format: z.literal('TEXT'),
      structuredContent: structuredLesson,
      durationSeconds: z.number().int().min(0).max(86400).nullable(),
    })
    .strict(),
  z.object({ format: z.literal('EXTERNAL'), externalTargetId: id }).strict(),
  z
    .object({
      format: z.enum(['VIDEO', 'PDF', 'IMAGE']),
      downloadAllowed: z.boolean(),
      altText: text().nullable(),
      durationSeconds: z.number().int().min(0).max(86400).nullable(),
    })
    .strict(),
]);
export const resourceInput = z
  .object({ description: text(2000).nullable(), downloadAllowed: z.boolean() })
  .strict();
export const questionInput = z
  .object({
    type: z.enum([
      'SINGLE_CHOICE',
      'MULTIPLE_CHOICE',
      'TRUE_FALSE',
      'SHORT_TEXT',
      'LONG_TEXT',
    ]),
    prompt: text(12000),
    explanation: text(4000).nullable(),
    published: z.boolean(),
    options: z
      .array(z.object({ label: text(2000), correct: z.boolean() }).strict())
      .max(30),
  })
  .strict()
  .superRefine((q, ctx) => {
    const choice = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(
        q.type,
      ),
      correct = q.options.filter((o) => o.correct).length;
    if (
      choice
        ? q.options.length < 2 ||
          correct < 1 ||
          (q.type !== 'MULTIPLE_CHOICE' && correct !== 1) ||
          (q.type === 'TRUE_FALSE' &&
            (q.options.length !== 2 ||
              q.options[0].label !== 'True' ||
              q.options[1].label !== 'False'))
        : q.options.length !== 0
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use valid options/correct answers for this question type.',
      });
  });
export const activityInput = z
  .object({
    instructions: text(12000),
    passingPercent: z.number().min(0).max(100).nullable(),
    attemptLimit: z.number().int().min(1).max(100).nullable(),
    reviewAnswers: z.boolean(),
    questions: z
      .array(
        z
          .object({ questionId: id, points: z.number().int().min(1).max(1000) })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (a) =>
      new Set(a.questions.map((q) => q.questionId)).size === a.questions.length,
  );
export const assignmentInput = z
  .object({
    instructions: text(12000),
    dueAt: z.string().datetime({ offset: true }).nullable(),
    allowedKinds: z
      .array(z.enum(['TEXT', 'FILE', 'TEXT_AND_FILE']))
      .min(1)
      .max(3),
    maxFiles: z.number().int().min(0).max(5),
    maxFileBytes: z.number().int().min(1).max(10485760),
    requiresAcceptance: z.boolean(),
    allowResubmission: z.boolean(),
  })
  .strict()
  .refine(
    (a) =>
      new Set(a.allowedKinds).size === a.allowedKinds.length &&
      (a.allowedKinds.every((k) => k === 'TEXT') || a.maxFiles > 0),
  );
