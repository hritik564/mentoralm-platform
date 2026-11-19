import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient, Prisma } from '../../../generated/prisma/client';
import { StudentError } from '../../student/errors';
import { parseInput } from '../../admin/validation';
import { intentRefInput } from '../enrollment/validation';
import { commerceAudit, commerceTransaction, purchaseLock } from './core';
export type PurchasePolicy = {
  version: string;
  termsPath: string;
  privacyPath: string;
};
export const orderInput = z
  .object({
    intentRef: intentRefInput,
    revision: z.string().uuid(),
    termsVersion: z.string().min(1).max(100),
    acknowledge: z.literal(true),
  })
  .strict();
export const orderInclude = {
  attempt: true,
  entitlement: true,
  intent: { select: { publicRef: true } },
} as const;
export type OrderRow = Prisma.MarketplaceOrderGetPayload<{
  include: typeof orderInclude;
}>;
export function orderDTO(row: OrderRow) {
  return {
    ref: row.publicRef,
    intentRef: row.intent.publicRef,
    status: row.status,
    revision: row.revision,
    program: {
      title: row.titleSnapshot,
      priceMinor: row.totalMinor,
      currency: row.currency,
      durationLabel: row.durationLabel,
      deliveryMode: row.deliveryMode,
      cohortStartsAt: row.cohortStartsAt?.toISOString() || null,
    },
    paymentStatus: row.attempt?.status || null,
    failureCode: row.attempt?.failureCode || null,
    entitlementStatus: row.entitlement?.status || null,
    paidAt: row.paidAt?.toISOString() || null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
export class CommerceOrders {
  constructor(
    protected db: PrismaClient,
    protected now: () => Date = () => new Date(),
  ) {}
  async owned(ref: string, userId: string) {
    if (!intentRefInput.safeParse(ref).success)
      throw new StudentError('NOT_FOUND');
    const row = await this.db.marketplaceOrder.findUnique({
      where: { publicRef: ref },
      include: orderInclude,
    });
    if (!row || row.userId !== userId) throw new StudentError('NOT_FOUND');
    return row;
  }
  async view(ref: string, userId: string) {
    return orderDTO(await this.owned(ref, userId));
  }
  async create(userId: string, input: unknown, policy: PurchasePolicy | null) {
    const data = parseInput(orderInput, input);
    if (!policy || data.termsVersion !== policy.version)
      throw new StudentError('UNAVAILABLE');
    const row = await commerceTransaction(this.db, async (tx) => {
      const intent = await tx.marketplaceEnrollmentIntent.findUnique({
        where: { publicRef: data.intentRef },
        include: { offering: true, onboarding: true },
      });
      if (!intent || intent.userId !== userId)
        throw new StudentError('NOT_FOUND');
      await purchaseLock(tx, userId, intent.offeringId);
      if (
        intent.expiresAt <= this.now() ||
        intent.state !== 'READY_FOR_CHECKOUT' ||
        !intent.onboarding?.completedAt ||
        intent.redactedAt ||
        intent.offering.publicationStatus !== 'PUBLISHED' ||
        intent.offering.availabilityStatus !== 'OPEN' ||
        intent.offering.priceMinor === null
      )
        throw new StudentError('CONFLICT');
      if (
        await tx.marketplaceEntitlement.findFirst({
          where: { userId, offeringId: intent.offeringId, status: 'ACTIVE' },
        })
      )
        throw new StudentError('CONFLICT');
      const expired = await tx.marketplaceOrder.findMany({
        where: {
          userId,
          offeringId: intent.offeringId,
          status: 'PENDING_PAYMENT',
          expiresAt: { lte: this.now() },
          attempt: null,
        },
        select: { id: true, intentId: true },
      });
      for (const old of expired) {
        await tx.marketplaceOrder.update({
          where: { id: old.id },
          data: { status: 'EXPIRED', revision: crypto.randomUUID() },
        });
        await commerceAudit(
          tx,
          old.intentId,
          old.id,
          'OrderExpired',
          userId,
          'PAYMENT_WINDOW_EXPIRED',
        );
      }
      const existing = await tx.marketplaceOrder.findUnique({
        where: { intentId: intent.id },
        include: orderInclude,
      });
      if (existing) {
        if (existing.termsVersion !== policy.version)
          throw new StudentError('CONFLICT');
        if (
          !['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(existing.status)
        )
          throw new StudentError('CONFLICT');
        return existing;
      }
      if (intent.revision !== data.revision) throw new StudentError('CONFLICT');
      if (
        await tx.marketplaceOrder.findFirst({
          where: {
            userId,
            offeringId: intent.offeringId,
            status: {
              in: [
                'PENDING_PAYMENT',
                'PAYMENT_PROCESSING',
                'REVIEW',
                'REFUND_PENDING',
              ],
            },
          },
        })
      )
        throw new StudentError('CONFLICT');
      const created = await tx.marketplaceOrder.create({
        data: {
          publicRef: randomBytes(32).toString('base64url'),
          intentId: intent.id,
          userId,
          offeringId: intent.offeringId,
          titleSnapshot: intent.titleSnapshot,
          subtotalMinor: intent.priceMinor,
          totalMinor: intent.priceMinor,
          currency: intent.currency,
          durationLabel: intent.durationLabel,
          deliveryMode: intent.deliveryMode,
          cohortStartsAt: intent.cohortStartsAt,
          expiresAt: intent.expiresAt,
          termsVersion: policy.version,
          acknowledgedAt: this.now(),
        },
        include: orderInclude,
      });
      await commerceAudit(tx, intent.id, created.id, 'OrderCreated', userId);
      return created;
    });
    return orderDTO(row);
  }
}
export type OrderView = ReturnType<typeof orderDTO>;
