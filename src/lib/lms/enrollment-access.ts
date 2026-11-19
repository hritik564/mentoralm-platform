import type { Prisma } from '../../generated/prisma/client';
/** Independent enrollments retain their authority. Marketplace-created rows need a live commercial grant. */
export function enrollmentAccessWhere(): Prisma.EnrollmentWhereInput {
  return {
    OR: [
      { marketplaceCreator: null },
      {
        marketplaceDeliveries: {
          some: { status: 'ACTIVE', entitlement: { status: 'ACTIVE' } },
        },
      },
    ],
  };
}
