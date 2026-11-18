import 'server-only';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { parseInput } from '../admin/validation';
import { safeMarketplaceImage } from './images';
import { publicOfferingsInput } from './validation';
import type { PublicOffering } from './types';

export type PublicOfferingsQuery = {
  page?: number;
  limit?: number;
  featured?: boolean;
};
const publicSelect = {
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

/** Direct, uncached read with an explicit whitelist; database injection is test-only. */
export async function readPublishedOfferings(
  db: PrismaClient,
  options: PublicOfferingsQuery = {},
) {
  const p = parseInput(publicOfferingsInput, options);
  const where: Prisma.MarketplaceOfferingWhereInput = {
    publicationStatus: 'PUBLISHED',
    ...(p.featured ? { featured: true } : {}),
  };
  const [rows, total] = await Promise.all([
    db.marketplaceOffering.findMany({
      where,
      select: publicSelect,
      skip: (p.page - 1) * p.limit,
      take: p.limit,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    }),
    db.marketplaceOffering.count({ where }),
  ]);
  const offerings: PublicOffering[] = await Promise.all(
    rows.map(async (row) => ({
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
    })),
  );
  return { status: 'ready' as const, offerings, total, page: p.page };
}
