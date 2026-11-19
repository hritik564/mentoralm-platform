import {
  initializeDelivery,
  requestDeliveryRevocation,
} from '../delivery/state';
import 'server-only';
import type {
  PrismaClient,
  MarketplacePaymentAttempt,
  MarketplaceOrder,
} from '../../../generated/prisma/client';
import type { PaymentEvidence } from './gateway';
import { requireAdminPermission } from '../../auth/admin-policy';
import {
  commerceTransaction,
  purchaseLock,
  commerceAudit,
  revised,
} from './core';
export async function settleVerifiedPayment(
  db: PrismaClient,
  now: () => Date,
  attempt: MarketplacePaymentAttempt & { order: MarketplaceOrder },
  e: PaymentEvidence,
  actorId: string | null,
  eventId?: string,
  adminActorId?: string,
) {
  await commerceTransaction(db, async (tx) => {
    if (adminActorId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(19748962,4)`;
      await requireAdminPermission(tx, adminActorId, 'COMMERCE_VIEW');
      await requireAdminPermission(tx, adminActorId, 'COMMERCE_MANAGE');
    }
    await purchaseLock(tx, attempt.order.userId, attempt.order.offeringId);
    const a = await tx.marketplacePaymentAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
        include: { order: { include: { entitlement: true } } },
      }),
      o = a.order;
    const finish = async (
      status: 'PROCESSED' | 'REJECTED',
      safeCode: string | null = null,
    ) => {
      if (eventId)
        await tx.marketplacePaymentEvent.update({
          where: { id: eventId },
          data: { status, processedAt: now(), safeCode },
        });
    };
    const captured = e.payments.filter(
      (p) => p.status === 'CAPTURED' || p.status === 'REFUNDED',
    );
    const mismatch =
      e.merchantRef !== a.merchantRef ||
      e.sessionId !== a.providerSessionId ||
      e.receipt !== a.idempotencyKey ||
      e.amountMinor !== o.totalMinor ||
      e.currency !== o.currency ||
      e.payments.some(
        (p) =>
          p.sessionId !== e.sessionId ||
          p.currency !== o.currency ||
          p.amountMinor !== o.totalMinor ||
          p.refundedMinor > p.amountMinor,
      ) ||
      captured.length > 1;
    const review = async (code: string) => {
      if (!['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(o.status))
        await tx.marketplaceOrder.update({
          where: { id: o.id },
          data: { status: 'REVIEW', ...revised() },
        });
      await tx.marketplacePaymentAttempt.update({
        where: { id: a.id },
        data: { failureCode: code, ...revised() },
      });
      await commerceAudit(
        tx,
        o.intentId,
        o.id,
        'PaymentReviewRequired',
        actorId,
        code,
      );
      await finish('REJECTED', code);
    };
    if (mismatch) {
      await review('EVIDENCE_MISMATCH');
      return;
    }
    const event = eventId
      ? await tx.marketplacePaymentEvent.findUnique({
          where: { id: eventId },
        })
      : null;
    if (event?.kind === 'DISPUTE') {
      if (
        !event.providerPaymentId ||
        !e.payments.some((p) => p.id === event.providerPaymentId)
      ) {
        await review('DISPUTE_PAYMENT_MISMATCH');
        return;
      }
      if (o.status !== 'REFUNDED') {
        await tx.marketplaceOrder.update({
          where: { id: o.id },
          data: {
            status:
              o.status === 'PAID' || o.status === 'REFUND_PENDING'
                ? 'REFUND_PENDING'
                : 'REVIEW',
            ...revised(),
          },
        });
        await tx.marketplacePaymentAttempt.update({
          where: { id: a.id },
          data: { failureCode: 'PAYMENT_DISPUTE', ...revised() },
        });
        if (o.entitlement?.status === 'ACTIVE') {
          await tx.marketplaceEntitlement.update({
            where: { id: o.entitlement.id },
            data: {
              status: 'REVOKED',
              revokedAt: now(),
              reason: 'PROVIDER_DISPUTE',
            },
          });
          await requestDeliveryRevocation(tx, o.entitlement.id);
          await commerceAudit(
            tx,
            o.intentId,
            o.id,
            'EntitlementRevoked',
            actorId,
            'PROVIDER_DISPUTE',
          );
        }
      }
      await finish('PROCESSED');
      return;
    }
    const payment = captured[0];
    if (payment) {
      if (!e.paid) {
        await review('ORDER_NOT_SETTLED');
        return;
      }
      if (a.providerPaymentId && a.providerPaymentId !== payment.id) {
        await review('PAYMENT_REBIND');
        return;
      }
      const consumed = await tx.marketplacePaymentAttempt.findFirst({
        where: {
          provider: a.provider,
          merchantRef: a.merchantRef,
          providerPaymentId: payment.id,
          id: { not: a.id },
        },
      });
      if (consumed) {
        await review('PAYMENT_ALREADY_USED');
        return;
      }
      if (payment.refundedMinor > 0) {
        const full = payment.refundedMinor === payment.amountMinor;
        if (o.status !== 'REFUNDED') {
          await tx.marketplacePaymentAttempt.update({
            where: { id: a.id },
            data: {
              providerPaymentId: payment.id,
              status: full ? 'REFUNDED' : 'CAPTURED',
              failureCode: full ? 'PAYMENT_REFUNDED' : 'PARTIAL_REFUND',
              ...revised(),
            },
          });
          await tx.marketplaceOrder.update({
            where: { id: o.id },
            data: {
              status: full ? 'REFUNDED' : 'REFUND_PENDING',
              ...revised(),
            },
          });
          if (
            o.entitlement &&
            (o.entitlement.status === 'ACTIVE' ||
              (full && o.entitlement.status !== 'REFUNDED'))
          ) {
            await tx.marketplaceEntitlement.update({
              where: { id: o.entitlement.id },
              data: {
                status: full ? 'REFUNDED' : 'REVOKED',
                revokedAt: now(),
                reason: full ? 'PROVIDER_REFUND' : 'PARTIAL_REFUND',
              },
            });
            await requestDeliveryRevocation(tx, o.entitlement.id);
            await commerceAudit(
              tx,
              o.intentId,
              o.id,
              'EntitlementRevoked',
              actorId,
              full ? 'PROVIDER_REFUND' : 'PARTIAL_REFUND',
            );
          }
        }
        await finish('PROCESSED');
        return;
      }
      if (['PAID', 'REFUNDED', 'REFUND_PENDING'].includes(o.status)) {
        await finish('PROCESSED');
        return;
      }
      await tx.marketplacePaymentAttempt.update({
        where: { id: a.id },
        data: {
          providerPaymentId: payment.id,
          status: 'CAPTURED',
          ...revised(),
        },
      });
      if (
        o.expiresAt <= now() ||
        !['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(o.status)
      ) {
        await review('SETTLEMENT_REQUIRES_REVIEW');
        return;
      }
      if (
        await tx.marketplaceEntitlement.findFirst({
          where: {
            userId: o.userId,
            offeringId: o.offeringId,
            status: 'ACTIVE',
          },
        })
      ) {
        await review('ALREADY_ENTITLED');
        return;
      }
      await tx.marketplacePaymentAttempt.update({
        where: { id: a.id },
        data: {
          providerPaymentId: payment.id,
          status: 'CAPTURED',
          failureCode: null,
          ...revised(),
        },
      });
      await tx.marketplaceOrder.update({
        where: { id: o.id },
        data: { status: 'PAID', paidAt: now(), ...revised() },
      });
      const entitlement = await tx.marketplaceEntitlement.create({
        data: {
          userId: o.userId,
          offeringId: o.offeringId,
          orderId: o.id,
          grantedAt: now(),
        },
      });
      await initializeDelivery(tx, entitlement.id);
      await commerceAudit(tx, o.intentId, o.id, 'PaymentConfirmed', actorId);
      await commerceAudit(tx, o.intentId, o.id, 'EntitlementGranted', actorId);
      if (actorId)
        await commerceAudit(tx, o.intentId, o.id, 'PaymentReconciled', actorId);
      await finish('PROCESSED');
      return;
    }
    // Provider state snapshots cannot downgrade a captured/refunded attempt.
    if (!['CAPTURED', 'REFUNDED'].includes(a.status)) {
      const authorized = e.payments.some((p) => p.status === 'AUTHORIZED'),
        failed = !authorized && e.payments.some((p) => p.status === 'FAILED');
      await tx.marketplacePaymentAttempt.update({
        where: { id: a.id },
        data: {
          status:
            authorized || a.status === 'AUTHORIZED'
              ? 'AUTHORIZED'
              : 'PROVIDER_PENDING',
          failureCode: failed ? 'PAYMENT_FAILED' : null,
          ...revised(),
        },
      });
      if (failed && a.failureCode !== 'PAYMENT_FAILED')
        await commerceAudit(
          tx,
          o.intentId,
          o.id,
          'PaymentFailed',
          actorId,
          'PAYMENT_FAILED',
        );
    }
    await finish('PROCESSED');
  });
}
