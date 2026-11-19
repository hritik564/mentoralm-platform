import 'server-only';
import { randomUUID } from 'node:crypto';
import type {
  Prisma,
  PrismaClient,
  MarketplaceCommerceEventKind,
} from '../../../generated/prisma/client';
import { StudentError } from '../../student/errors';
export type TX = Prisma.TransactionClient;
export async function commerceTransaction<T>(
  db: PrismaClient,
  work: (tx: TX) => Promise<T>,
): Promise<T> {
  for (let i = 0; i < 10; i++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        (('code' in error && ['P2034', 'P2002'].includes(String(error.code))) ||
          ('cause' in error &&
            error.cause &&
            typeof error.cause === 'object' &&
            'originalCode' in error.cause &&
            ['40001', '40P01'].includes(String(error.cause.originalCode)))) &&
        i < 9
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 10 + Math.floor(Math.random() * 40)),
        );
        continue;
      }
      throw error;
    }
  }
  throw new StudentError('CONFLICT');
}
export async function purchaseLock(tx: TX, userId: string, offeringId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`marketplace-purchase:${userId}:${offeringId}`},0))::text`;
}
export async function commerceAudit(
  tx: TX,
  intentId: string,
  orderId: string | null,
  kind: MarketplaceCommerceEventKind,
  actorId: string | null = null,
  safeCode: string | null = null,
) {
  await tx.marketplaceCommerceEvent.create({
    data: { intentId, orderId, kind, actorId, safeCode },
  });
}
export const revised = () => ({ revision: randomUUID() });
