import { z } from 'zod';
import {
  availabilityStatuses,
  deliveryModes,
  marketplaceImages,
  publicationStatuses,
} from './types';

const plain = (max: number, required = false) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) =>
        !/[<>]/.test(value) &&
        [...value].every(
          (c) => c.charCodeAt(0) >= 32 || ['\n', '\r', '\t'].includes(c),
        ),
    )
    .refine((value) => !required || value.length > 0);
const fields = {
  title: plain(160, true),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shortDescription: plain(600),
  category: plain(100),
  cardImage: z.enum(marketplaceImages).nullable(),
  heroImage: z.enum(marketplaceImages).nullable(),
  deliveryMode: z.enum(deliveryModes),
  durationLabel: plain(120),
  priceMinor: z.number().int().min(0).max(2147483647).nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('INR'),
  availabilityStatus: z.enum(availabilityStatuses),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(100000),
  lmsEnabled: z.boolean(),
  courseRef: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{35,500}$/)
    .nullable(),
  cohortStartsAt: z.iso.datetime({ offset: true }).nullable(),
};
export const createOfferingInput = z.object(fields).strict();
export const updateOfferingInput = z
  .object({ ...fields, revision: z.string().uuid() })
  .strict();
export const offeringRevisionInput = z
  .object({ revision: z.string().uuid() })
  .strict();
export const marketplaceListInput = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    q: z.string().trim().max(100).default(''),
    status: z
      .enum(publicationStatuses)
      .or(z.literal(''))
      .optional()
      .transform((value) => value || undefined),
  })
  .strict();
export const publicOfferingsInput = z
  .object({
    page: z.number().int().min(1).max(10000).default(1),
    limit: z.number().int().min(1).max(20).default(20),
    featured: z.boolean().optional(),
  })
  .strict();
