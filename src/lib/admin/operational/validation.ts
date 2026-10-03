import { z } from 'zod';
import { text } from '../academic/validation';
export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const reviewInput = z
  .object({
    courseId: id,
    itemId: id,
    userId: id,
    responseId: id,
    awardedPoints: z.number().int().min(0).max(1000),
    feedback: text(2000).nullable(),
  })
  .strict();
export const certificateInput = z
  .object({
    action: z.enum(['SUSPEND', 'RESTORE', 'REVOKE']),
    reason: text(500),
  })
  .strict();
export const attendanceInput = z
  .object({
    rows: z
      .array(
        z
          .object({
            membershipId: id,
            userId: id,
            status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
            reason: text(500),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .refine((x) => new Set(x.rows.map((r) => r.userId)).size === x.rows.length);
export const assignmentReviewInput = z
  .object({
    versionId: id,
    userId: id,
    courseId: id,
    itemId: id,
    status: z.enum(['UNDER_REVIEW', 'CHANGES_REQUESTED', 'ACCEPTED']),
    feedback: text(4000),
  })
  .strict();
export const moderationInput = z
  .object({ locked: z.boolean(), reason: text(500) })
  .strict();
export const supportInput = z
  .object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    body: text(4000).nullable(),
  })
  .strict();
export const communicationInput = z
  .object({
    batchId: id,
    channel: z.enum(['EMAIL', 'WHATSAPP', 'IN_APP']),
    purpose: z.enum(['OPERATIONAL', 'MARKETING']),
    subject: text(160),
    body: text(6000),
  })
  .strict();
export const audienceInput = communicationInput.omit({
  subject: true,
  body: true,
});
