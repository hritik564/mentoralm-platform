import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { testDatabaseUrl } from './d4-database';
import { m6Flow } from './marketplace-m6';
import { providerFixture } from './marketplace-m4-provider';
import { fixturePurchasePolicy } from './marketplace-m4';
import { CommerceOrders } from '../../src/lib/marketplace/commerce/orders';
import { CommercePayments } from '../../src/lib/marketplace/commerce/payments';
import { MarketplaceDeliveryService } from '../../src/lib/marketplace/delivery/service';
import { paymentWebhook } from '../../src/lib/marketplace/commerce/http';
import { adminHandle } from '../../src/lib/admin/handles';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync, renameSync } from 'node:fs';
async function main() {
  const schema = process.env.D4_TEST_SCHEMA,
    url = testDatabaseUrl();
  if (
    !url ||
    !schema ||
    !/^d4_[a-f0-9]{24}$/.test(schema) ||
    process.env.MENTORALM_ENV !== 'local'
  )
    throw Error('Guarded isolated Test required');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema }),
  });
  const file = `docs/reviews/marketplace-m6/mock-provider-${schema}.json`,
    provider = providerFixture(`m6${randomUUID().replaceAll('-', '')}`);
  if (existsSync(file)) {
    const rows = JSON.parse(readFileSync(file, 'utf8'));
    for (const row of rows) provider.sessions.set(row.id, row);
  }
  const input = JSON.parse(readFileSync(0, 'utf8') || '{"action":"seed"}');
  try {
    const owner = await db.user.findFirstOrThrow({
        where: { roleAssignments: { some: { role: 'ADMIN' } } },
      }),
      orders = new CommerceOrders(db),
      payments = new CommercePayments(db, provider.gateway);
    let result: unknown;
    if (input.action === 'seed') {
      const main = await m6Flow(db, {
        userId: owner.id,
        title: 'M6 Launch Readiness Program',
        provider,
      });
      await main.intents.cancel(main.intent.ref, owner.id, {
        revision: main.intent.revision,
      });
      await db.marketplaceOffering.update({
        where: { id: main.offering.id },
        data: { slug: 'm6-launch-program' },
      });
      const states: Record<string, unknown> = {};
      for (const state of ['active', 'review', 'pending']) {
        const p = await m6Flow(db, {
            userId: owner.id,
            title: `M6 ${state} program`,
            provider,
          }),
          { order } = await p.pay();
        await p.payments.reconcile(order.ref, owner.id);
        if (state === 'review')
          await db.course.update({
            where: { id: p.course.id },
            data: { published: false },
          });
        if (state !== 'pending')
          await new MarketplaceDeliveryService(db).reconcile({
            ownerId: owner.id,
          });
        const d = await db.marketplaceDelivery.findFirstOrThrow({
          where: { entitlement: { order: { publicRef: order.ref } } },
        });
        if (state === 'pending')
          await db.marketplaceDelivery.update({
            where: { id: d.id },
            data: {
              status: 'PROVISIONING',
              attemptCount: 1,
              lastAttemptAt: new Date(),
            },
          });
        states[state] = {
          orderRef: order.ref,
          deliveryRef: d.publicRef,
          courseId: p.course.id,
        };
      }
      await db.adminAuthorization.update({
        where: { userId: owner.id },
        data: {
          permissions: [
            'MARKETPLACE_MANAGE',
            'COMMERCE_VIEW',
            'COMMERCE_MANAGE',
            'DELIVERY_MANAGE',
          ],
        },
      });
      result = {
        slug: 'm6-launch-program',
        courseId: main.course.id,
        itemId: main.item.id,
        offeringRef: adminHandle('offering', main.offering.id),
        ...states,
      };
    } else if (input.action === 'order')
      result = await orders.create(owner.id, input.body, fixturePurchasePolicy);
    else if (input.action === 'pay')
      result = await payments.open(input.ref, owner.id);
    else if (input.action === 'capture' || input.action === 'refund') {
      const row = await orders.owned(input.ref, owner.id);
      const session = row.attempt?.providerSessionId;
      if (!session || !provider.sessions.has(session))
        throw Error('Mock provider session missing');
      const payment = provider.payment(
          session,
          input.action === 'refund'
            ? { status: 'refunded', amount_refunded: row.totalMinor }
            : {},
        ),
        event = provider.event(
          session,
          input.action === 'refund' ? 'refund.processed' : 'payment.captured',
          `evt_m6_${randomUUID()}`,
        );
      await paymentWebhook(
        new Request('http://127.0.0.1:3113/api/payments/razorpay/webhook', {
          method: 'POST',
          headers: event.headers,
          body: new Uint8Array(event.raw),
        }),
        payments,
      );
      result =
        input.action === 'refund'
          ? await orders.view(input.ref, owner.id)
          : {
              razorpay_order_id: session,
              razorpay_payment_id: payment.id,
              razorpay_signature: provider.returnSignature(session, payment.id),
            };
    } else if (input.action === 'return')
      result = await payments.returnFromCheckout(
        input.ref,
        owner.id,
        input.body,
      );
    else if (input.action === 'view')
      result = await orders.view(input.ref, owner.id);
    else throw Error('Unsupported isolated action');
    const temp = file + '.tmp';
    writeFileSync(temp, JSON.stringify([...provider.sessions.values()]));
    renameSync(temp, file);
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'M6 isolated fixture refused/failed; private details withheld.',
  );
  process.exitCode = 1;
});
