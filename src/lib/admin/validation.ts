import { StudentError } from '../student/errors';
import { z } from 'zod';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const nullableId = id.nullable();
const text = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine((v) => !/[<>]/.test(v) && [...v].every((c) => c.charCodeAt(0) >= 32));
const date = z.string().datetime({ offset: true });
export const batchInput = z
  .object({
    code: text
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/),
    name: text,
    status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']),
    programId: nullableId,
    courseId: nullableId,
    startsAt: date.nullable(),
    endsAt: date.nullable(),
    lmsAccessEnabled: z.boolean(),
  })
  .strict()
  .refine((v) => !(v.programId && v.courseId))
  .refine(
    (v) =>
      !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt),
  );
export const sessionInput = z
  .object({
    title: text,
    courseId: nullableId,
    itemId: nullableId,
    instructorId: nullableId,
    startsAt: date,
    endsAt: date,
    status: z.enum(['SCHEDULED', 'HELD', 'CANCELLED']),
    externalTargetId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,100}$/)
      .nullable(),
    locationLabel: text.nullable(),
  })
  .strict()
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt));
export const membershipInput = z
  .object({ userId: id, status: z.enum(['ACTIVE', 'INACTIVE']) })
  .strict();
export const instructorInput = z
  .object({ instructorId: id, assigned: z.boolean() })
  .strict();
export const overrideInput = z
  .object({ value: z.enum(['INHERIT', 'ENABLED', 'DISABLED']) })
  .strict();
export const enrollmentInput = z
  .object({
    courseId: id,
    value: z.enum(['ENROLLED', 'IN_PROGRESS']).nullable(),
  })
  .strict();
export const recordingInput = z
  .object({
    action: z.enum([
      'UPLOAD',
      'PUBLISH',
      'UNPUBLISH',
      'DELETE',
      'REPLACE',
      'RETRY_CLEANUP',
      'METADATA',
    ]),
    revision: z.string().uuid().optional(),
    title: text.nullable().optional(),
    description: z
      .string()
      .trim()
      .max(2000)
      .refine(
        (v) => !/[<>]/.test(v) && [...v].every((c) => c.charCodeAt(0) >= 32),
      )
      .nullable()
      .optional(),
  })
  .strict();
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new StudentError('INVALID_INPUT');
  return result.data;
}
