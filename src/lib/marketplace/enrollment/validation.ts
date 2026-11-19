import { z } from 'zod';
import { educationLevels, currentStatuses } from './types';
export const intentRefInput = z
  .string()
  .length(43)
  .regex(/^[A-Za-z0-9_-]{43}$/);
export const browserSecretInput = z
  .string()
  .length(43)
  .regex(/^[A-Za-z0-9_-]{43}$/);
const plain = (value: string) =>
  !/[<>]/.test(value) &&
  [...value].every(
    (char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127,
  );
const text = (min: number, max: number) =>
  z
    .string()
    .max(max)
    .refine(plain)
    .transform((value) => value.trim())
    .pipe(z.string().min(min));
const optional = (max: number) =>
  text(0, max)
    .nullable()
    .transform((v) => v || null);
export const startIntentInput = z
  .object({
    slug: z
      .string()
      .max(100)
      .refine(plain)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();
export const intentRevisionInput = z
  .object({ revision: z.string().uuid() })
  .strict();
export const aboutInput = z
  .object({
    fullName: text(2, 120),
    phone: z
      .string()
      .max(32)
      .refine(plain)
      .transform((v) => v.replace(/[ ()-]/g, ''))
      .pipe(z.string().regex(/^\+[1-9][0-9]{7,14}$/)),
    city: text(2, 100),
    region: text(2, 100),
    country: text(2, 80),
  })
  .strict();
export const educationInput = z
  .object({
    educationLevel: z.enum(educationLevels),
    currentStatus: z.enum(currentStatuses),
    institution: optional(160),
  })
  .strict();
export const goalInput = z
  .object({ goal: text(10, 1500), source: optional(200) })
  .strict();
export const onboardingStepInput = z.discriminatedUnion('step', [
  aboutInput
    .extend({ step: z.literal(1), revision: z.string().uuid() })
    .strict(),
  educationInput
    .extend({ step: z.literal(2), revision: z.string().uuid() })
    .strict(),
  goalInput
    .extend({ step: z.literal(3), revision: z.string().uuid() })
    .strict(),
  z
    .object({
      step: z.literal(4),
      revision: z.string().uuid(),
      consent: z.literal(true),
    })
    .strict(),
]);
