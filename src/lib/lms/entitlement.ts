import type { Prisma } from '../../generated/prisma/client';

/** Business-data entitlement, never Clerk metadata or a course access grant. */
export function entitledStudentWhere(
  id: string,
  now = new Date(),
): Prisma.UserWhereInput {
  return {
    id,
    role: 'STUDENT',
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
