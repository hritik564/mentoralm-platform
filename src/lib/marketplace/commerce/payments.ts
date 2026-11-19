import { z } from 'zod';
import { marketplaceDiagnostic } from '../diagnostics';
import { settleVerifiedPayment } from './settlement';
import 'server-only';
import { requireAdminPermission } from '../../auth/admin-policy';
import { randomBytes } from 'node:crypto';
import type { PaymentGateway, GatewaySession } from './gateway';
import { evidenceInput } from './gateway';
import { CommerceOrders } from './orders';
import {
  commerceAudit,
  commerceTransaction,
  purchaseLock,
  revised,
} from './core';
import { StudentError } from '../../student/errors';
import type {
  PrismaClient,
  MarketplacePaymentAttempt,
} from '../../../generated/prisma/client';
export class CommercePayments extends CommerceOrders {
  constructor(
    db: PrismaClient,
    private gateway: PaymentGateway,
    now: () => Date = () => new Date(),
  ) {
    super(db, now);
  }
  private correctGateway(attempt: MarketplacePaymentAttempt) {
    if (
      attempt.provider !== this.gateway.provider ||
      attempt.merchantRef !== this.gateway.merchantRef
    )
      throw new StudentError('UNAVAILABLE');
  }
  async open(ref: string, userId: string) {
    const owned = await this.owned(ref, userId);
    const attempt = await commerceTransaction(this.db, async (tx) => {
      await purchaseLock(tx, owned.userId, owned.offeringId);
      const order = await tx.marketplaceOrder.findUniqueOrThrow({
        where: { id: owned.id },
        include: { intent: { include: { offering: true, onboarding: true } } },
      });
      if (
        order.expiresAt <= this.now() ||
        !['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(order.status) ||
        !order.acknowledgedAt ||
        !order.termsVersion ||
        order.intent.state !== 'READY_FOR_CHECKOUT' ||
        !order.intent.onboarding?.completedAt ||
        order.intent.redactedAt ||
        order.intent.offering.publicationStatus !== 'PUBLISHED' ||
        order.intent.offering.availabilityStatus !== 'OPEN' ||
        order.intent.offering.priceMinor === null
      )
        throw new StudentError('CONFLICT');
      if (
        await tx.marketplaceEntitlement.findFirst({
          where: { userId, offeringId: order.offeringId, status: 'ACTIVE' },
        })
      )
        throw new StudentError('CONFLICT');
      if (!this.gateway.supports(order.totalMinor, order.currency))
        throw new StudentError('CONFLICT');
      let row = await tx.marketplacePaymentAttempt.findUnique({
        where: { orderId: order.id },
      });
      if (!row) {
        row = await tx.marketplacePaymentAttempt.create({
          data: {
            publicRef: randomBytes(32).toString('base64url'),
            orderId: order.id,
            provider: this.gateway.provider,
            merchantRef: this.gateway.merchantRef,
            amountMinor: order.totalMinor,
            currency: order.currency,
          },
        });
        await commerceAudit(
          tx,
          order.intentId,
          order.id,
          'PaymentAttemptCreated',
          userId,
        );
      }
      return row;
    });
    this.correctGateway(attempt);
    if (!attempt.providerSessionId) {
      const admitted = await this.db.marketplacePaymentAttempt.updateMany({
        where: { id: attempt.id, status: 'CREATED' },
        data: { status: 'CREATING', ...revised() },
      });
      try {
        const session =
          admitted.count === 1
            ? await this.gateway.createSession({
                receipt: attempt.idempotencyKey,
                amountMinor: attempt.amountMinor,
                currency: attempt.currency,
              })
            : await this.gateway.recoverSession(attempt.idempotencyKey);
        if (session) await this.bind(attempt, session);
        else throw new StudentError('UNAVAILABLE');
      } catch {
        await this.db.marketplacePaymentAttempt.updateMany({
          where: {
            id: attempt.id,
            providerSessionId: null,
            status: { in: ['CREATING', 'CREATED'] },
          },
          data: {
            status: 'UNKNOWN',
            failureCode: 'PROVIDER_STATUS_UNKNOWN',
            ...revised(),
          },
        });
        marketplaceDiagnostic('MARKETPLACE_PROVIDER_UNKNOWN');
        throw new StudentError('UNAVAILABLE');
      }
    }
    const current = await this.db.marketplacePaymentAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    if (!current.providerSessionId) throw new StudentError('UNAVAILABLE');
    return this.gateway.checkout({
      id: current.providerSessionId,
      receipt: current.idempotencyKey,
      amountMinor: current.amountMinor,
      currency: current.currency,
    });
  }
  private async bind(
    attempt: MarketplacePaymentAttempt,
    session: GatewaySession,
  ) {
    if (
      session.receipt !== attempt.idempotencyKey ||
      session.amountMinor !== attempt.amountMinor ||
      session.currency !== attempt.currency
    )
      throw new StudentError('CONFLICT');
    await commerceTransaction(this.db, async (tx) => {
      const order = await tx.marketplaceOrder.findUniqueOrThrow({
        where: { id: attempt.orderId },
      });
      await purchaseLock(tx, order.userId, order.offeringId);
      const before = await tx.marketplacePaymentAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      if (before.providerSessionId && before.providerSessionId !== session.id)
        throw new StudentError('CONFLICT');
      if (!before.providerSessionId) {
        await tx.marketplacePaymentAttempt.update({
          where: { id: attempt.id },
          data: {
            providerSessionId: session.id,
            status: 'PROVIDER_PENDING',
            failureCode: null,
            ...revised(),
          },
        });
        await tx.marketplaceOrder.update({
          where: { id: order.id },
          data: { status: 'PAYMENT_PROCESSING', ...revised() },
        });
        await commerceAudit(tx, order.intentId, order.id, 'PaymentPending');
      }
    });
  }
  async returnFromCheckout(ref: string, userId: string, input: unknown) {
    const row = await this.owned(ref, userId);
    if (!row.attempt?.providerSessionId) throw new StudentError('CONFLICT');
    this.correctGateway(row.attempt);
    this.gateway.verifyReturn(row.attempt.providerSessionId, input);
    return this.reconcile(ref, userId);
  }
  async reconcile(ref: string, userId: string) {
    const order = await this.owned(ref, userId);
    if (order.attempt) await this.reconcileAttempt(order.attempt.id, userId);
    return this.view(ref, userId);
  }
  async reconcileAttempt(
    id: string,
    actorId: string | null = null,
    asAdmin = false,
  ) {
    if (asAdmin) {
      if (!actorId) throw new StudentError('FORBIDDEN');
      await requireAdminPermission(this.db, actorId, 'COMMERCE_VIEW');
      await requireAdminPermission(this.db, actorId, 'COMMERCE_MANAGE');
    }
    let attempt = await this.db.marketplacePaymentAttempt.findUniqueOrThrow({
      where: { id },
      include: { order: true },
    });
    this.correctGateway(attempt);
    if (!attempt.providerSessionId) {
      const session = await this.gateway.recoverSession(attempt.idempotencyKey);
      if (!session) throw new StudentError('UNAVAILABLE');
      await this.bind(attempt, session);
      attempt = await this.db.marketplacePaymentAttempt.findUniqueOrThrow({
        where: { id },
        include: { order: true },
      });
    }
    const evidence = evidenceInput.safeParse(
      await this.gateway.inspect(attempt.providerSessionId!),
    );
    if (!evidence.success) throw new StudentError('UNAVAILABLE');
    await settleVerifiedPayment(
      this.db,
      this.now,
      attempt,
      evidence.data,
      actorId,
      undefined,
      asAdmin ? actorId || undefined : undefined,
    );
  }
  async consumeWebhook(raw: Buffer, headers: Headers) {
    const verified = this.gateway.verifyWebhook(raw, headers);
    let existing = await this.db.marketplacePaymentEvent.findFirst({
      where: {
        provider: this.gateway.provider,
        merchantRef: this.gateway.merchantRef,
        OR: [
          { providerEventId: verified.id },
          { payloadDigest: verified.digest },
        ],
      },
    });
    if (existing && existing.payloadDigest !== verified.digest)
      throw new StudentError('CONFLICT');
    if (!existing) {
      try {
        existing = await this.db.marketplacePaymentEvent.create({
          data: {
            provider: this.gateway.provider,
            merchantRef: verified.merchantRef,
            providerEventId: verified.id,
            kind: verified.kind,
            eventType: verified.type,
            providerSessionId: verified.sessionId,
            providerPaymentId: verified.paymentId,
            payloadDigest: verified.digest,
          },
        });
      } catch (error) {
        if (!(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ))
          throw error;
        existing = await this.db.marketplacePaymentEvent.findFirstOrThrow({
          where: {
            provider: this.gateway.provider,
            merchantRef: this.gateway.merchantRef,
            OR: [
              { providerEventId: verified.id },
              { payloadDigest: verified.digest },
            ],
          },
        });
        if (existing.payloadDigest !== verified.digest)
          throw new StudentError('CONFLICT');
      }
    }
    if (existing.status === 'PROCESSED') return;
    if (verified.kind === 'IGNORED') {
      await this.db.marketplacePaymentEvent.update({
        where: { id: existing.id },
        data: {
          status: 'PROCESSED',
          processedAt: this.now(),
          safeCode: 'EVENT_IGNORED',
        },
      });
      return;
    }
    await this.processEvent(existing.id);
  }
  async processEvent(id: string, adminActorId?: string) {
    if (adminActorId) {
      await requireAdminPermission(this.db, adminActorId, 'COMMERCE_VIEW');
      await requireAdminPermission(this.db, adminActorId, 'COMMERCE_MANAGE');
    }
    const event = await this.db.marketplacePaymentEvent.findUniqueOrThrow({
      where: { id },
    });
    if (
      event.provider !== this.gateway.provider ||
      event.merchantRef !== this.gateway.merchantRef
    )
      throw new StudentError('UNAVAILABLE');
    if (event.status === 'PROCESSED') return;
    // Recovery must preserve the adapter's normalized ignore decision even if
    // the original inbox acknowledgement failed after its durable insertion.
    if (event.kind === 'IGNORED') {
      await this.db.marketplacePaymentEvent.update({
        where: { id },
        data: {
          status: 'PROCESSED',
          processedAt: this.now(),
          safeCode: 'EVENT_IGNORED',
        },
      });
      return;
    }
    let sessionId = event.providerSessionId;
    if (!sessionId && event.providerPaymentId)
      sessionId = await this.gateway.sessionForPayment(event.providerPaymentId);
    if (!sessionId) {
      await this.db.marketplacePaymentEvent.update({
        where: { id },
        data: { status: 'UNRESOLVED', safeCode: 'NO_SESSION' },
      });
      marketplaceDiagnostic('MARKETPLACE_RECONCILIATION_NEEDED');
      return;
    }
    const evidence = evidenceInput.safeParse(
      await this.gateway.inspect(sessionId),
    );
    if (!evidence.success) throw new StudentError('UNAVAILABLE');
    let attempt = await this.db.marketplacePaymentAttempt.findFirst({
      where: {
        provider: this.gateway.provider,
        merchantRef: this.gateway.merchantRef,
        providerSessionId: sessionId,
      },
      include: { order: true },
    });
    if (!attempt) {
      if (!z.string().uuid().safeParse(evidence.data.receipt).success) {
        await this.db.marketplacePaymentEvent.update({
          where: { id },
          data: { status: 'UNRESOLVED', safeCode: 'NO_LOCAL_RECEIPT' },
        });
        marketplaceDiagnostic('MARKETPLACE_RECONCILIATION_NEEDED');
        return;
      }
      attempt = await this.db.marketplacePaymentAttempt.findFirst({
        where: {
          provider: this.gateway.provider,
          merchantRef: this.gateway.merchantRef,
          idempotencyKey: evidence.data.receipt,
        },
        include: { order: true },
      });
      if (!attempt) {
        await this.db.marketplacePaymentEvent.update({
          where: { id },
          data: { status: 'UNRESOLVED', safeCode: 'UNMATCHED_SESSION' },
        });
        marketplaceDiagnostic('MARKETPLACE_RECONCILIATION_NEEDED');
        return;
      }
      await this.bind(attempt, {
        id: sessionId,
        receipt: evidence.data.receipt,
        amountMinor: evidence.data.amountMinor,
        currency: evidence.data.currency,
      });
      attempt = await this.db.marketplacePaymentAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
        include: { order: true },
      });
    }
    await settleVerifiedPayment(
      this.db,
      this.now,
      attempt,
      evidence.data,
      adminActorId || null,
      event.id,
      adminActorId,
    );
  }
}
