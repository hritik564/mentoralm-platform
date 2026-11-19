import 'server-only';
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '../../../generated/prisma/client';
import { requireAdminPermission } from '../../auth/admin-policy';
import { StudentError } from '../../student/errors';
import {
  commerceTransaction,
  purchaseLock,
  commerceAudit,
  revised,
} from './core';
/** Operational PII minimization, not a legal/accounting record-deletion policy. */
export const retentionPolicy = {
  anonymousDays: 7,
  abandonedDays: 30,
  maxBatch: 100,
} as const;
export async function cleanupMarketplace(
  db: PrismaClient,
  actorId: string,
  {
    apply = false,
    batchSize = 50,
    now = new Date(),
  }: { apply?: boolean; batchSize?: number; now?: Date } = {},
) {
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > retentionPolicy.maxBatch
  )
    throw new StudentError('INVALID_INPUT');
  return commerceTransaction(db, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(19748962,4)`;
    await requireAdminPermission(tx, actorId, 'COMMERCE_MANAGE');
    const candidates = await tx.marketplaceEnrollmentIntent.findMany({
      where: {
        redactedAt: null,
        AND: [
          {
            OR: [
              { order: null },
              {
                order: {
                  is: {
                    status: {
                      in: [
                        'PENDING_PAYMENT',
                        'PAYMENT_PROCESSING',
                        'EXPIRED',
                        'CANCELLED',
                      ],
                    },
                    entitlement: null,
                    OR: [
                      { attempt: null },
                      {
                        attempt: {
                          is: {
                            status: 'PROVIDER_PENDING',
                            failureCode: 'PAYMENT_FAILED',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
        OR: [
          {
            userId: null,
            expiresAt: { lte: new Date(now.getTime() - 7 * 86400000) },
          },
          {
            userId: { not: null },
            expiresAt: { lte: new Date(now.getTime() - 30 * 86400000) },
          },
        ],
      },
      include: { order: { include: { attempt: true, entitlement: true } } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: batchSize,
    });
    let eligible = 0;
    for (const row of candidates) {
      if (row.userId) await purchaseLock(tx, row.userId, row.offeringId);
      const order = row.order;
      if (
        order &&
        ((order.attempt &&
          !(
            order.attempt.status === 'PROVIDER_PENDING' &&
            order.attempt.failureCode === 'PAYMENT_FAILED'
          )) ||
          order.entitlement ||
          ![
            'PENDING_PAYMENT',
            'PAYMENT_PROCESSING',
            'EXPIRED',
            'CANCELLED',
          ].includes(order.status))
      )
        continue;
      eligible++;
      if (!apply) continue;
      if (
        order &&
        ['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(order.status)
      )
        await tx.marketplaceOrder.update({
          where: { id: order.id },
          data: { status: 'EXPIRED', ...revised() },
        });
      await tx.marketplaceEnrollmentIntent.update({
        where: { id: row.id },
        data: {
          state: row.state === 'CANCELLED' ? 'CANCELLED' : 'EXPIRED',
          redactedAt: now,
          browserHash: row.userId ? null : randomBytes(32).toString('hex'),
          ...revised(),
        },
      });
      await tx.marketplaceEnrollmentOnboarding.deleteMany({
        where: { intentId: row.id },
      });
      await commerceAudit(
        tx,
        row.id,
        order?.id || null,
        'OnboardingRedacted',
        actorId,
        'ABANDONED_RETENTION',
      );
    }
    return {
      mode: apply ? 'applied' : 'dry-run',
      examined: candidates.length,
      eligible,
      redacted: apply ? eligible : 0,
    };
  });
}
