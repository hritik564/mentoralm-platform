import { z } from 'zod';
import { supportCategories } from '../dashboard/support';
const plain = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        !/[<>]/.test(value) &&
        !Array.from(value).some((character) => {
          const code = character.charCodeAt(0);
          return code < 32 && ![9, 10, 13].includes(code);
        }),
      'Use plain text without HTML.',
    );
export const profileInput = z
  .object({
    educationLevel: plain(80).nullable(),
    institution: plain(160).nullable(),
    graduationYear: z.number().int().min(1900).max(2200).nullable(),
    interests: z.array(plain(60)).max(12),
    careerGoals: plain(1000).nullable(),
  })
  .strict();
export const ticketInput = z
  .object({
    category: z.enum(supportCategories),
    subject: plain(120),
    message: plain(4000),
  })
  .strict();
export const replyInput = z.object({ message: plain(4000) }).strict();
export const viewInput = z
  .object({ courseId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/) })
  .strict();
export const referralInput = z
  .object({ code: z.string().regex(/^[a-zA-Z0-9_-]{20,64}$/) })
  .strict();
export type ProfileInput = z.infer<typeof profileInput>;
