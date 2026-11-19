import 'server-only';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { parseInput } from '../admin/validation';
import { publicOfferingSelect, toPublicOffering } from './offering-projection';
import { publicOfferingsInput } from './validation';

export type PublicOfferingsQuery = {
  page?: number;
  limit?: number;
  featured?: boolean;
};
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
      select: publicOfferingSelect,
      skip: (p.page - 1) * p.limit,
      take: p.limit,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    }),
    db.marketplaceOffering.count({ where }),
  ]);
  const offerings = await Promise.all(rows.map(toPublicOffering));
  return { status: 'ready' as const, offerings, total, page: p.page };
}

export { readPublishedProgram } from './program-queries';
