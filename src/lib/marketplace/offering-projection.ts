import 'server-only';
import type { Prisma } from '../../generated/prisma/client';
import { safeMarketplaceImage } from './images';
import type { PublicOffering } from './types';

export const publicOfferingSelect = {
  slug: true,
  title: true,
  shortDescription: true,
  category: true,
  cardImage: true,
  heroImage: true,
  deliveryMode: true,
  durationLabel: true,
  priceMinor: true,
  currency: true,
  availabilityStatus: true,
  cohortStartsAt: true,
} as const satisfies Prisma.MarketplaceOfferingSelect;

export async function toPublicOffering(
  row: Prisma.MarketplaceOfferingGetPayload<{
    select: typeof publicOfferingSelect;
  }>,
): Promise<PublicOffering> {
  return {
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription,
    category: row.category,
    cardImage: await safeMarketplaceImage(row.cardImage),
    heroImage: await safeMarketplaceImage(row.heroImage),
    deliveryMode: row.deliveryMode,
    durationLabel: row.durationLabel,
    priceMinor: row.priceMinor,
    currency: row.currency,
    availabilityStatus: row.availabilityStatus,
    cohortStartsAt: row.cohortStartsAt?.toISOString() || null,
  };
}
