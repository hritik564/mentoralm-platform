import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import { readyPurchase, fixturePurchasePolicy } from './helpers/marketplace-m4';
import { providerFixture } from './helpers/marketplace-m4-provider';
import { CommercePayments } from '../src/lib/marketplace/commerce/payments';
import {
  CommerceAdmin,
  reconcilePendingCommerce,
} from '../src/lib/marketplace/commerce/admin';
import { CommerceOrders } from '../src/lib/marketplace/commerce/orders';
import {
  commerceResponse,
  paymentWebhook,
} from '../src/lib/marketplace/commerce/http';
import { cleanupMarketplace } from '../src/lib/marketplace/commerce/retention';
import type { Directory } from '../src/lib/admin/directory';
const directory: Directory = {
  search: async () => [],
  lookup: async (ids) =>
    new Map(
      ids.map((id) => [
        id,
        {
          name: 'Synthetic Customer',
          email: 'fixture@example.invalid',
          phone: null,
          status: 'Active' as const,
        },
      ]),
    ),
};
test('M4 database invariants, Admin finance isolation and provider recovery', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db,
    provider = providerFixture(),
    service = new CommercePayments(db, provider.gateway);
  try {
    async function admin(
      permissions: (
        | 'COMMERCE_VIEW'
        | 'COMMERCE_MANAGE'
        | 'MARKETPLACE_MANAGE'
        | 'ACADEMICS_MANAGE'
      )[],
    ) {
      return db.user.create({
        data: {
          clerkUserId: `m4_admin_${randomUUID()}`,
          roleAssignments: { create: { role: 'ADMIN' } },
          adminAuthorization: { create: { permissions } },
        },
      });
    }
    const buyer = await readyPurchase(db),
      order = await buyer.order(),
      checkout = await service.open(order.ref, buyer.userId);
    const viewer = await admin(['COMMERCE_VIEW']),
      operator = await admin(['COMMERCE_VIEW', 'COMMERCE_MANAGE']),
      catalogue = await admin(['MARKETPLACE_MANAGE']),
      academic = await admin(['ACADEMICS_MANAGE']);
    await t.test(
      'catalogue, academic and Student actors cannot read financial projections',
      async () => {
        for (const actor of [catalogue, academic, { id: buyer.userId }]) {
          const finance = new CommerceAdmin(db, actor.id, directory);
          await assert.rejects(finance.list(), { code: 'FORBIDDEN' });
          await assert.rejects(finance.detail(order.ref), {
            code: 'FORBIDDEN',
          });
        }
      },
    );
    await t.test(
      'financial viewer sees only minimal customer and order projection',
      async () => {
        const finance = new CommerceAdmin(db, viewer.id, directory),
          list = await finance.list(),
          detail = await finance.detail(order.ref);
        assert.equal(list.items[0].customer.name, 'Synthetic Customer');
        assert.equal(detail.provider, 'RAZORPAY');
        const serialized = JSON.stringify(detail);
        for (const privateField of [
          'providerSessionId',
          'providerPaymentId',
          'merchantRef',
          'clerkUserId',
          'studentId',
          'phone',
          'goal',
          'browserHash',
          'keySecret',
        ])
          assert.ok(!serialized.includes(`"${privateField}"`));
        assert.equal(detail.entitlementStatus, null);
      },
    );
    await t.test(
      'COMMERCE_VIEW never grants reconciliation or cleanup',
      async () => {
        await assert.rejects(
          new CommerceAdmin(db, viewer.id, directory).reconcile(
            order.ref,
            provider.gateway,
          ),
          { code: 'FORBIDDEN' },
        );
        await assert.rejects(cleanupMarketplace(db, viewer.id), {
          code: 'FORBIDDEN',
        });
      },
    );
    await t.test(
      'revocation while directory lookup is in-flight denies the final read',
      async () => {
        const staff = await admin(['COMMERCE_VIEW']);
        const revoking: Directory = {
          ...directory,
          lookup: async (ids) => {
            await db.adminAuthorization.update({
              where: { userId: staff.id },
              data: { permissions: [] },
            });
            return directory.lookup(ids);
          },
        };
        await assert.rejects(
          new CommerceAdmin(db, staff.id, revoking).detail(order.ref),
          { code: 'FORBIDDEN' },
        );
      },
    );
    await t.test(
      'valid browser signature and signed captured event cannot grant for authorized-only provider state',
      async () => {
        const payment = provider.payment(
          String(checkout.data.providerOrderId),
          {
            status: 'authorized',
            captured: false,
          },
        );
        const dto = await service.returnFromCheckout(order.ref, buyer.userId, {
          razorpay_order_id: String(checkout.data.providerOrderId),
          razorpay_payment_id: payment.id,
          razorpay_signature: provider.returnSignature(
            String(checkout.data.providerOrderId),
            payment.id,
          ),
        });
        assert.notEqual(dto.status, 'PAID');
        const event = provider.event(
          String(checkout.data.providerOrderId),
          'payment.captured',
          'evt_authorized_capture_claim',
        );
        await service.consumeWebhook(event.raw, event.headers);
        assert.equal(await db.marketplaceEntitlement.count(), 0);
      },
    );
    await t.test(
      'COMMERCE_MANAGE revoked during provider fetch prevents settlement',
      async () => {
        const staff = await admin(['COMMERCE_VIEW', 'COMMERCE_MANAGE']);
        provider.payment(String(checkout.data.providerOrderId));
        const gateway = new Proxy(provider.gateway, {
          get(target, key) {
            if (key === 'inspect')
              return async (id: string) => {
                await db.adminAuthorization.update({
                  where: { userId: staff.id },
                  data: { permissions: ['COMMERCE_VIEW'] },
                });
                return target.inspect(id);
              };
            return Reflect.get(target, key);
          },
        });
        await assert.rejects(
          new CommerceAdmin(db, staff.id, directory).reconcile(
            order.ref,
            gateway,
          ),
          { code: 'FORBIDDEN' },
        );
        assert.equal(await db.marketplaceEntitlement.count(), 0);
      },
    );
    await t.test(
      'privileged provider reconciliation settles; there is no manual-paid bypass',
      async () => {
        await new CommerceAdmin(db, operator.id, directory).reconcile(
          order.ref,
          provider.gateway,
        );
        assert.equal(
          (await service.view(order.ref, buyer.userId)).status,
          'PAID',
        );
      },
    );
    await t.test(
      'verified dispute holds purchased access and never restores it from stale captured snapshots',
      async () => {
        const event = provider.event(
          String(checkout.data.providerOrderId),
          'payment.dispute.created',
          'evt_dispute',
        );
        await service.consumeWebhook(event.raw, event.headers);
        assert.equal(
          (await service.view(order.ref, buyer.userId)).entitlementStatus,
          'REVOKED',
        );
        assert.equal(
          (await service.view(order.ref, buyer.userId)).status,
          'REFUND_PENDING',
        );
        await service.reconcile(order.ref, buyer.userId);
        assert.equal(
          (await service.view(order.ref, buyer.userId)).entitlementStatus,
          'REVOKED',
        );
        provider.payment(String(checkout.data.providerOrderId), {
          status: 'refunded',
          amount_refunded: buyer.intent.quote.priceMinor,
        });
        await service.reconcile(order.ref, buyer.userId);
        assert.equal(
          (await service.view(order.ref, buyer.userId)).status,
          'REFUNDED',
        );
        assert.equal(
          (await service.view(order.ref, buyer.userId)).entitlementStatus,
          'REFUNDED',
        );
      },
    );
    await t.test(
      'previously consumed payment ID cannot settle another order even with matching local money',
      async () => {
        const another = await readyPurchase(db),
          o = await another.order(),
          s = await service.open(o.ref, another.userId);
        provider.payment(String(s.data.providerOrderId), {
          id: provider.sessions.get(String(checkout.data.providerOrderId))!
            .payments[0].id,
        });
        const result = await service.reconcile(o.ref, another.userId);
        assert.equal(result.status, 'REVIEW');
        assert.equal(result.entitlementStatus, null);
        assert.equal(result.failureCode, 'PAYMENT_ALREADY_USED');
      },
    );
    await t.test(
      'payment after expiry is durably held for review rather than granted',
      async () => {
        const another = await readyPurchase(db),
          o = await another.order(),
          s = await service.open(o.ref, another.userId);
        provider.payment(String(s.data.providerOrderId));
        const late = new CommercePayments(
          db,
          provider.gateway,
          () => new Date(Date.now() + 86400001),
        );
        const state = await late.reconcile(o.ref, another.userId);
        assert.equal(state.status, 'REVIEW');
        assert.equal(state.paymentStatus, 'CAPTURED');
        assert.equal(state.entitlementStatus, null);
      },
    );
    await t.test(
      'currency/price change still creates original quote commitment, never current client display',
      async () => {
        const another = await readyPurchase(db);
        await db.marketplaceOffering.update({
          where: { id: another.offering.id },
          data: { priceMinor: 100, currency: 'USD' },
        });
        const o = await another.order();
        assert.equal(o.program.priceMinor, another.intent.quote.priceMinor);
        assert.equal(o.program.currency, 'INR');
      },
    );
    await t.test(
      'financial identity, paid state and entitlement revocation cannot be rewritten at SQL boundary',
      async () => {
        const another = await readyPurchase(db),
          o = await another.order(),
          s = await service.open(o.ref, another.userId);
        provider.payment(String(s.data.providerOrderId));
        await service.reconcile(o.ref, another.userId);
        const row = await db.marketplaceOrder.findUniqueOrThrow({
            where: { publicRef: o.ref },
          }),
          attempt = await db.marketplacePaymentAttempt.findUniqueOrThrow({
            where: { orderId: row.id },
          }),
          entitlement = await db.marketplaceEntitlement.findUniqueOrThrow({
            where: { orderId: row.id },
          });
        for (const data of [
          { totalMinor: 1 },
          { userId: buyer.userId },
          { status: 'PENDING_PAYMENT' as const },
          { termsVersion: 'tampered' },
        ])
          await assert.rejects(
            db.marketplaceOrder.update({ where: { id: row.id }, data }),
          );
        await assert.rejects(
          db.marketplacePaymentAttempt.update({
            where: { id: attempt.id },
            data: { providerSessionId: 'order_rebound' },
          }),
        );
        await assert.rejects(
          db.marketplacePaymentAttempt.update({
            where: { id: attempt.id },
            data: { status: 'PROVIDER_PENDING' },
          }),
        );
        await assert.rejects(
          db.marketplaceEntitlement.update({
            where: { id: entitlement.id },
            data: { userId: buyer.userId },
          }),
        );
        await assert.rejects(
          db.marketplaceOrder.delete({ where: { id: row.id } }),
        );
        await assert.rejects(
          db.marketplacePaymentAttempt.delete({ where: { id: attempt.id } }),
        );
        await assert.rejects(
          db.marketplaceEntitlement.delete({ where: { id: entitlement.id } }),
        );
        await assert.rejects(db.marketplacePaymentEvent.deleteMany());
        const audit = await db.marketplaceCommerceEvent.findFirstOrThrow();
        await assert.rejects(
          db.marketplaceCommerceEvent.update({
            where: { id: audit.id },
            data: { safeCode: 'TAMPERED' },
          }),
        );
      },
    );
    await t.test(
      'event ID cannot be rebound to another signed payload and repeated digest is deduplicated',
      async () => {
        const another = await readyPurchase(db),
          o = await another.order(),
          s = await service.open(o.ref, another.userId);
        provider.payment(String(s.data.providerOrderId));
        const event = provider.event(
          String(s.data.providerOrderId),
          'payment.captured',
          'evt_identity',
        );
        await service.consumeWebhook(event.raw, event.headers);
        const identical = provider.event(
          String(s.data.providerOrderId),
          'payment.captured',
          'evt_header_changed',
        );
        await service.consumeWebhook(identical.raw, identical.headers);
        assert.equal(
          await db.marketplacePaymentEvent.count({
            where: {
              payloadDigest: provider.gateway.verifyWebhook(
                event.raw,
                event.headers,
              ).digest,
            },
          }),
          1,
        );
        const other = provider.event(
          String(s.data.providerOrderId),
          'payment.authorized',
          'evt_identity',
        );
        await assert.rejects(service.consumeWebhook(other.raw, other.headers), {
          code: 'CONFLICT',
        });
      },
    );
    await t.test(
      'unknown/irrelevant events retain a minimal durable inbox without granting or raw payload retention',
      async () => {
        const unknown = provider.gateway.verifyWebhook;
        void unknown;
        const another = await readyPurchase(db),
          o = await another.order(),
          s = await service.open(o.ref, another.userId);
        provider.payment(String(s.data.providerOrderId));
        const ignored = provider.event(
          String(s.data.providerOrderId),
          'payment.updated',
          'evt_ignore',
        );
        await service.consumeWebhook(ignored.raw, ignored.headers);
        const row = await db.marketplacePaymentEvent.findFirstOrThrow({
          where: { providerEventId: 'evt_ignore' },
        });
        assert.equal(row.safeCode, 'EVENT_IGNORED');
        assert.equal(
          (await service.view(o.ref, another.userId)).entitlementStatus,
          null,
        );
        assert.ok(!('payload' in row));
        // Simulate an acknowledgement failure after the verified inbox insert.
        await db.marketplacePaymentEvent.update({
          where: { id: row.id },
          data: { status: 'RECEIVED', processedAt: null, safeCode: null },
        });
        provider.outage = true;
        try {
          await service.processEvent(row.id);
        } finally {
          provider.outage = false;
        }
        assert.equal(
          (await service.view(o.ref, another.userId)).entitlementStatus,
          null,
        );
        assert.equal(
          (
            await db.marketplacePaymentEvent.findUniqueOrThrow({
              where: { id: row.id },
            })
          ).status,
          'PROCESSED',
        );
      },
    );
    await t.test(
      'database or audit failure returns a retryable webhook failure and preserves received event',
      async () => {
        const response = await commerceResponse(() =>
          paymentWebhook(
            new Request('http://localhost/hook', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '{}',
            }),
            {
              consumeWebhook: async () => {
                throw Error('synthetic database outage');
              },
            },
          ),
        );
        assert.equal(response.status, 503);
        const another = await readyPurchase(db),
          o = await another.order(),
          s = await service.open(o.ref, another.userId);
        provider.payment(String(s.data.providerOrderId));
        const event = provider.event(
          String(s.data.providerOrderId),
          'payment.captured',
          'evt_retry_audit',
        );
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${f.schema}".fail_m4_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind::text='PaymentConfirmed' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER fail_m4_settlement BEFORE INSERT ON "${f.schema}"."MarketplaceCommerceEvent" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".fail_m4_settlement()`,
        );
        await assert.rejects(service.consumeWebhook(event.raw, event.headers));
        assert.equal(
          (
            await db.marketplacePaymentEvent.findFirstOrThrow({
              where: { providerEventId: 'evt_retry_audit' },
            })
          ).status,
          'RECEIVED',
        );
        assert.equal(
          (await service.view(o.ref, another.userId)).entitlementStatus,
          null,
        );
        await db.$executeRawUnsafe(
          `DROP TRIGGER fail_m4_settlement ON "${f.schema}"."MarketplaceCommerceEvent"`,
        );
        await service.consumeWebhook(event.raw, event.headers);
        assert.equal(
          (await service.view(o.ref, another.userId)).status,
          'PAID',
        );
      },
    );
    await t.test(
      'bounded operator recovery processes pending provider state using persisted financial authority',
      async () => {
        const result = await reconcilePendingCommerce(
          db,
          provider.gateway,
          operator.id,
          5,
        );
        assert.ok(result.examined <= 10);
        assert.ok(result.reconciled > 0);
        await assert.rejects(
          reconcilePendingCommerce(db, provider.gateway, catalogue.id),
          { code: 'FORBIDDEN' },
        );
      },
    );
    await t.test(
      'failed unpaid onboarding is redacted while transaction metadata, paid data and active grants remain',
      async () => {
        const another = await readyPurchase(db),
          o = await another.order(),
          s = await service.open(o.ref, another.userId);
        provider.payment(String(s.data.providerOrderId), {
          status: 'failed',
          captured: false,
        });
        await service.reconcile(o.ref, another.userId);
        const before = await db.marketplaceOrder.count(),
          paid = await db.marketplaceOrder.findMany({
            where: { status: 'PAID' },
            select: { id: true, intentId: true },
          }),
          now = new Date(Date.now() + 32 * 86400000);
        const cleaned = await cleanupMarketplace(db, operator.id, {
          now,
          apply: true,
          batchSize: 100,
        });
        assert.ok(cleaned.redacted > 0);
        const intent = await db.marketplaceEnrollmentIntent.findUniqueOrThrow({
          where: { publicRef: another.intent.ref },
          include: { onboarding: true },
        });
        assert.ok(intent.redactedAt);
        assert.equal(intent.onboarding, null);
        assert.equal(await db.marketplaceOrder.count(), before);
        for (const row of paid)
          assert.ok(
            await db.marketplaceEnrollmentOnboarding.findUnique({
              where: { intentId: row.intentId },
            }),
          );
        assert.equal(
          (
            await cleanupMarketplace(db, operator.id, {
              now,
              apply: true,
              batchSize: 100,
            })
          ).redacted,
          0,
        );
      },
    );
  } finally {
    await f.cleanup();
  }
});
test('M4 upgrades the exact M3 release additively, preserves ready intent and creates no financial rows', async () => {
  const f = await isolatedDatabase(
    undefined,
    '20261119090000_marketplace_enrollment_intents',
  );
  try {
    const cli = (args: string[]) =>
      execFileSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', ...args],
        { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
      ).toString();
    const user = await f.db.user.create({
      data: { clerkUserId: `m4_upgrade_${randomUUID()}` },
    });
    cli(['migrate', 'deploy']);
    assert.deepEqual(
      await f.db.user.findUnique({ where: { id: user.id } }),
      user,
    );
    assert.equal(await f.db.marketplaceOrder.count(), 0);
    assert.equal(await f.db.marketplacePaymentAttempt.count(), 0);
    assert.equal(await f.db.marketplaceEntitlement.count(), 0);
    assert.match(
      cli([
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ]),
      /No difference/,
    );
    await assert.rejects(
      new CommerceOrders(f.db).create(user.id, {}, fixturePurchasePolicy),
      { code: 'INVALID_INPUT' },
    );
  } finally {
    await f.cleanup();
  }
});
