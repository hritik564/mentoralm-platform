import type { Prisma } from '../../generated/prisma/client';

/** Identity is retained after commercial revocation; identity alone grants nothing. */
export function learnerIdentityWhere(): Prisma.UserWhereInput {
  return { OR: [{ role: 'STUDENT' }, { marketplaceLearner: { isNot: null } }] };
}

/** Independent business authority, without claiming Marketplace provenance. */
export function independentLmsAccessWhere(
  now = new Date(),
): Prisma.UserWhereInput {
  return {
    OR: [
      { lmsAccessOverride: 'ENABLED' },
      {
        lmsAccessOverride: null,
        memberships: {
          some: {
            status: 'ACTIVE',
            joinedAt: { lte: now },
            OR: [{ leftAt: null }, { leftAt: { gt: now } }],
            batch: {
              status: 'ACTIVE',
              lmsAccessEnabled: true,
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
              ],
            },
          },
        },
      },
    ],
  };
}

/** Public authorization requires final ACTIVE delivery. Explicit administrative denial wins. */
export function entitledStudentWhere(
  id: string,
  now = new Date(),
): Prisma.UserWhereInput {
  return {
    id,
    studentId: { not: null },
    AND: [
      learnerIdentityWhere(),
      {
        OR: [
          independentLmsAccessWhere(now),
          {
            lmsAccessOverride: null,
            marketplaceEntitlements: {
              some: {
                status: 'ACTIVE',
                delivery: {
                  type: 'LMS',
                  status: 'ACTIVE',
                  lmsAccessProvenance: { not: 'NONE' },
                },
              },
            },
          },
        ],
      },
    ],
  };
}
