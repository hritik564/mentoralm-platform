import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import { offeringInput } from './helpers/marketplace-m2';
import { providerFixture } from './helpers/marketplace-m4-provider';
import { EnrollmentService } from '../src/lib/marketplace/enrollment/service';
import { CommerceOrders } from '../src/lib/marketplace/commerce/orders';
import { CommercePayments } from '../src/lib/marketplace/commerce/payments';
import { cleanupMarketplace } from '../src/lib/marketplace/commerce/retention';
const policy = {
  version: 'test-fixture-terms-v1',
  termsPath: '/fixture-terms',
  privacyPath: '/fixture-privacy',
};
test('M4 PostgreSQL authoritative commerce, reconciliation, entitlement and retention', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db,
    provider = providerFixture();
  let clock = new Date();
  const intents = new EnrollmentService(db, () => clock),
    orders = new CommerceOrders(db, () => clock),
    payments = new CommercePayments(db, provider.gateway, () => clock);
  try {
    const owner = await db.user.create({
        data: { clerkUserId: `m4_${randomUUID()}` },
      }),
      other = await db.user.create({
        data: { clerkUserId: `m4_other_${randomUUID()}` },
      });
    let sequence = 0;
    async function ready(extra: object = {}) {
      sequence++;
      const { courseRef, ...input } = offeringInput(`m4-program-${sequence}`);
      void courseRef;
      const offering = await db.marketplaceOffering.create({
        data: {
          ...input,
          title: 'M4 Synthetic Program',
          publicationStatus: 'PUBLISHED',
          publishedAt: new Date(),
          ...extra,
        },
      });
      let intent = await intents.start(
        owner.id,
        randomBytes(32).toString('hex'),
        { slug: offering.slug },
      );
      for (const fields of [
        {
          step: 1,
          fullName: 'Synthetic Learner',
          phone: '+919876543210',
          city: 'Pune',
          region: 'Maharashtra',
          country: 'India',
        },
        {
          step: 2,
          educationLevel: 'UNDERGRADUATE',
          currentStatus: 'COLLEGE_STUDENT',
          institution: null,
        },
        {
          step: 3,
          goal: 'Build thoughtful practical technology skills.',
          source: null,
        },
        { step: 4, consent: true },
      ])
        intent = await intents.saveStep(intent.ref, owner.id, {
          revision: intent.revision,
          ...fields,
        });
      return {
        offering,
        intent,
        input: {
          intentRef: intent.ref,
          revision: intent.revision,
          termsVersion: policy.version,
          acknowledge: true,
        },
      };
    }
    const base = await ready();
    let order = await orders.create(owner.id, base.input, policy);
    await t.test(
      'READY intent creates one immutable quote Order; concurrent repeats reuse it',
      async () => {
        const result = await Promise.all(
          Array.from({ length: 6 }, () =>
            orders.create(owner.id, base.input, policy),
          ),
        );
        assert.ok(result.every((o) => o.ref === order.ref));
        assert.equal(await db.marketplaceOrder.count(), 1);
        assert.equal(order.program.priceMinor, base.intent.quote.priceMinor);
        assert.equal(order.program.currency, 'INR');
      },
    );
    await t.test(
      'client amount/owner/state mass assignment rejected',
      async () => {
        for (const data of [
          { totalMinor: 1 },
          { currency: 'USD' },
          { userId: other.id },
          { paid: true },
        ])
          await assert.rejects(
            orders.create(owner.id, { ...base.input, ...data }, policy),
            { code: 'INVALID_INPUT' },
          );
      },
    );
    await t.test('wrong user and guessed order fail uniformly', async () => {
      await assert.rejects(orders.create(other.id, base.input, policy), {
        code: 'NOT_FOUND',
      });
      await assert.rejects(orders.view(order.ref, other.id), {
        code: 'NOT_FOUND',
      });
      await assert.rejects(
        orders.view(randomBytes(32).toString('base64url'), owner.id),
        { code: 'NOT_FOUND' },
      );
    });
    await t.test(
      'committed onboarding cannot be edited or cancelled behind an Order',
      async () => {
        await assert.rejects(
          intents.saveStep(base.intent.ref, owner.id, {
            revision: base.intent.revision,
            step: 1,
            fullName: 'Changed Person',
            phone: '+919876543210',
            city: 'Pune',
            region: 'Maharashtra',
            country: 'India',
          }),
          { code: 'CONFLICT' },
        );
        await assert.rejects(
          intents.cancel(base.intent.ref, owner.id, {
            revision: base.intent.revision,
          }),
          { code: 'CONFLICT' },
        );
      },
    );
    await t.test(
      'one provider attempt/session across concurrent opens and stable receipt',
      async () => {
        const results = await Promise.allSettled(
          Array.from({ length: 6 }, () => payments.open(order.ref, owner.id)),
        );
        assert.ok(results.some((r) => r.status === 'fulfilled'));
        assert.equal(provider.creates, 1);
        assert.equal(await db.marketplacePaymentAttempt.count(), 1);
        const dto = await payments.open(order.ref, owner.id);
        assert.equal(dto.data.amountMinor, base.intent.quote.priceMinor);
        assert.equal(dto.data.currency, 'INR');
        assert.ok(!JSON.stringify(dto).includes(provider.config.keySecret));
        const a = await db.marketplacePaymentAttempt.findFirstOrThrow();
        assert.equal(
          provider.sessions.get(String(dto.data.providerOrderId))!.receipt,
          a.idempotencyKey,
        );
      },
    );
    const attempt = await db.marketplacePaymentAttempt.findFirstOrThrow(),
      sessionId = attempt.providerSessionId!;
    await t.test(
      'browser claims and invalid signatures cannot mark paid',
      async () => {
        await assert.rejects(
          payments.returnFromCheckout(order.ref, owner.id, { paid: true }),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(
          payments.returnFromCheckout(order.ref, owner.id, {
            razorpay_order_id: sessionId,
            razorpay_payment_id: 'pay_forged',
            razorpay_signature: '0'.repeat(64),
          }),
          { code: 'FORBIDDEN' },
        );
        assert.equal(await db.marketplaceEntitlement.count(), 0);
      },
    );
    await t.test(
      'pending and authorized evidence grant nothing; failure remains retryable on same session',
      async () => {
        provider.payment(sessionId, { status: 'failed', captured: false });
        let state = await payments.reconcile(order.ref, owner.id);
        assert.equal(state.failureCode, 'PAYMENT_FAILED');
        assert.equal(await db.marketplaceEntitlement.count(), 0);
        assert.equal(
          (await payments.open(order.ref, owner.id)).data.providerOrderId,
          sessionId,
        );
        provider.payment(sessionId, { status: 'authorized', captured: false });
        state = await payments.reconcile(order.ref, owner.id);
        assert.equal(state.paymentStatus, 'AUTHORIZED');
        assert.equal(await db.marketplaceEntitlement.count(), 0);
      },
    );
    await t.test(
      'verified captured payment + concurrent webhook/reconcile settles exactly once',
      async () => {
        provider.payment(sessionId);
        const event = provider.event(sessionId);
        await Promise.all([
          payments.consumeWebhook(event.raw, event.headers),
          payments.reconcile(order.ref, owner.id),
          payments.consumeWebhook(event.raw, event.headers),
        ]);
        order = await orders.view(order.ref, owner.id);
        assert.equal(order.status, 'PAID');
        assert.equal(order.paymentStatus, 'CAPTURED');
        assert.equal(order.entitlementStatus, 'ACTIVE');
        assert.equal(await db.marketplaceEntitlement.count(), 1);
        assert.equal(await db.marketplacePaymentEvent.count(), 1);
        assert.equal(
          await db.marketplaceCommerceEvent.count({
            where: { kind: 'EntitlementGranted' },
          }),
          1,
        );
      },
    );
    await t.test(
      'duplicate event replay and older authorized snapshot cannot downgrade settlement',
      async () => {
        const event = provider.event(sessionId);
        await payments.consumeWebhook(event.raw, event.headers);
        provider.payment(sessionId, { status: 'authorized', captured: false });
        await payments.consumeWebhook(
          ...(Object.values(
            provider.event(sessionId, 'payment.authorized', 'evt_authorized'),
          ) as [Buffer, Headers]),
        );
        assert.equal((await orders.view(order.ref, owner.id)).status, 'PAID');
        assert.equal(
          (await orders.view(order.ref, owner.id)).paymentStatus,
          'CAPTURED',
        );
        provider.payment(sessionId);
      },
    );
    await t.test(
      'active entitlement blocks repeat intents and Orders',
      async () => {
        await assert.rejects(orders.create(owner.id, base.input, policy), {
          code: 'CONFLICT',
        });
        await assert.rejects(
          intents.start(owner.id, randomBytes(32).toString('hex'), {
            slug: base.offering.slug,
          }),
          { code: 'CONFLICT' },
        );
      },
    );
    await t.test(
      'full provider refund revokes access without deleting financial history',
      async () => {
        provider.payment(sessionId, {
          status: 'refunded',
          captured: true,
          amount_refunded: base.intent.quote.priceMinor,
        });
        const event = provider.event(
          sessionId,
          'refund.processed',
          'evt_refund',
        );
        await payments.consumeWebhook(event.raw, event.headers);
        const result = await orders.view(order.ref, owner.id);
        assert.equal(result.status, 'REFUNDED');
        assert.equal(result.entitlementStatus, 'REFUNDED');
        assert.equal(await db.marketplaceOrder.count(), 1);
        assert.equal(await db.marketplacePaymentAttempt.count(), 1);
      },
    );
    for (const status of ['UNPUBLISHED', 'ARCHIVED', 'CLOSED'] as const)
      await t.test(`${status} blocks Order creation`, async () => {
        const fixture = await ready();
        await db.marketplaceOffering.update({
          where: { id: fixture.offering.id },
          data:
            status === 'CLOSED'
              ? { availabilityStatus: 'CLOSED' }
              : { publicationStatus: status },
        });
        await assert.rejects(orders.create(owner.id, fixture.input, policy), {
          code: 'CONFLICT',
        });
      });
    await t.test(
      'expired and incomplete intents cannot create Orders',
      async () => {
        const fixture = await ready();
        clock = new Date(clock.getTime() + 86400001);
        await assert.rejects(orders.create(owner.id, fixture.input, policy), {
          code: 'CONFLICT',
        });
        clock = new Date();
        const input = await intents.start(
          other.id,
          randomBytes(32).toString('hex'),
          { slug: base.offering.slug },
        );
        await assert.rejects(
          orders.create(
            other.id,
            {
              intentRef: input.ref,
              revision: input.revision,
              termsVersion: policy.version,
              acknowledge: true,
            },
            policy,
          ),
          { code: 'CONFLICT' },
        );
      },
    );
    await t.test(
      'provider outage preserves durable attempt and lost create response recovers without another POST',
      async () => {
        const fixture = await ready(),
          o = await orders.create(owner.id, fixture.input, policy);
        const count = provider.creates;
        provider.loseCreateResponse = true;
        await assert.rejects(payments.open(o.ref, owner.id), {
          code: 'UNAVAILABLE',
        });
        assert.equal(
          (await orders.view(o.ref, owner.id)).paymentStatus,
          'UNKNOWN',
        );
        await payments.open(o.ref, owner.id);
        assert.equal(provider.creates, count + 1);
        provider.outage = true;
        await assert.rejects(payments.reconcile(o.ref, owner.id), {
          code: 'UNAVAILABLE',
        });
        provider.outage = false;
        assert.equal(
          (await orders.view(o.ref, owner.id)).status,
          'PAYMENT_PROCESSING',
        );
      },
    );
    for (const mismatch of [
      'amount',
      'currency',
      'session',
      'receipt',
      'multiple',
      'merchant',
    ] as const)
      await t.test(
        `${mismatch} mismatch fails closed with no entitlement`,
        async () => {
          const fixture = await ready(),
            o = await orders.create(owner.id, fixture.input, policy),
            checkout = await payments.open(o.ref, owner.id),
            row = provider.sessions.get(String(checkout.data.providerOrderId))!;
          const p = provider.payment(row.id);
          if (mismatch === 'amount') p.amount++;
          if (mismatch === 'currency') p.currency = 'USD';
          if (mismatch === 'session') p.order_id = 'order_foreign';
          if (mismatch === 'receipt') row.receipt = randomUUID();
          if (mismatch === 'multiple')
            row.payments.push({ ...p, id: 'pay_second' });
          if (mismatch === 'merchant') {
            const foreign = {
              ...provider.gateway,
              provider: provider.gateway.provider,
              merchantRef: 'acc_foreign',
            };
            void foreign;
            const evil = new CommercePayments(db, {
              ...provider.gateway,
              provider: 'RAZORPAY',
              merchantRef: 'acc_other',
            } as never);
            await assert.rejects(evil.reconcile(o.ref, owner.id), {
              code: 'UNAVAILABLE',
            });
            return;
          }
          const state = await payments.reconcile(o.ref, owner.id);
          assert.equal(state.status, 'REVIEW');
          assert.equal(state.entitlementStatus, null);
        },
      );
    await t.test(
      'partial refund holds entitlement revoked for manual review',
      async () => {
        const fixture = await ready(),
          o = await orders.create(owner.id, fixture.input, policy),
          checkout = await payments.open(o.ref, owner.id);
        provider.payment(String(checkout.data.providerOrderId));
        await payments.reconcile(o.ref, owner.id);
        provider.payment(String(checkout.data.providerOrderId), {
          amount_refunded: 1,
        });
        await payments.reconcile(o.ref, owner.id);
        const result = await orders.view(o.ref, owner.id);
        assert.equal(result.status, 'REFUND_PENDING');
        assert.equal(result.entitlementStatus, 'REVOKED');
      },
    );
    await t.test(
      'audit failure rolls settlement and grant back together',
      async () => {
        const fixture = await ready(),
          o = await orders.create(owner.id, fixture.input, policy),
          checkout = await payments.open(o.ref, owner.id);
        provider.payment(String(checkout.data.providerOrderId));
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${f.schema}".fail_m4_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind::text='EntitlementGranted' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER fail_m4_audit BEFORE INSERT ON "${f.schema}"."MarketplaceCommerceEvent" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".fail_m4_audit()`,
        );
        await assert.rejects(payments.reconcile(o.ref, owner.id));
        assert.equal(
          (await orders.view(o.ref, owner.id)).entitlementStatus,
          null,
        );
        assert.notEqual((await orders.view(o.ref, owner.id)).status, 'PAID');
        await db.$executeRawUnsafe(
          `DROP TRIGGER fail_m4_audit ON "${f.schema}"."MarketplaceCommerceEvent"`,
        );
        await payments.reconcile(o.ref, owner.id);
        assert.equal((await orders.view(o.ref, owner.id)).status, 'PAID');
      },
    );
    await t.test(
      'no LMS enrollment, progress or batch membership; audit excludes PII',
      async () => {
        assert.equal(await db.enrollment.count(), 0);
        assert.equal(await db.lessonState.count(), 0);
        assert.equal(await db.batchMembership.count(), 0);
        const audit = JSON.stringify(
          await db.marketplaceCommerceEvent.findMany(),
        );
        for (const secret of [
          'Synthetic Learner',
          '+919876543210',
          'Build thoughtful practical technology skills.',
          provider.config.keySecret,
          provider.config.webhookSecrets[0],
        ])
          assert.ok(!audit.includes(secret));
      },
    );
    await t.test(
      'retention is privileged, bounded, dry-run first and preserves financial/entitlement rows',
      async () => {
        await assert.rejects(cleanupMarketplace(db, owner.id), {
          code: 'FORBIDDEN',
        });
        const admin = await db.user.create({
          data: {
            clerkUserId: `m4_admin_${randomUUID()}`,
            roleAssignments: { create: { role: 'ADMIN' } },
            adminAuthorization: {
              create: { permissions: ['COMMERCE_MANAGE'] },
            },
          },
        });
        const before = await db.marketplaceOrder.count(),
          entitlements = await db.marketplaceEntitlement.count();
        const now = new Date(Date.now() + 32 * 86400000),
          dry = await cleanupMarketplace(db, admin.id, { now });
        assert.ok(dry.eligible > 0);
        assert.equal(dry.redacted, 0);
        const applied = await cleanupMarketplace(db, admin.id, {
          now,
          apply: true,
        });
        assert.ok(applied.redacted > 0);
        assert.equal(await db.marketplaceOrder.count(), before);
        assert.equal(await db.marketplaceEntitlement.count(), entitlements);
        assert.equal(
          (await cleanupMarketplace(db, admin.id, { now, apply: true }))
            .redacted,
          0,
        );
      },
    );
  } finally {
    await f.cleanup();
  }
});
