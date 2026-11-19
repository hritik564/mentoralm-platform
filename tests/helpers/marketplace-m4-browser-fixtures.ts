import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { testDatabaseUrl } from './d4-database';
import { readyPurchase } from './marketplace-m4';
import { providerFixture } from './marketplace-m4-provider';
import { CommercePayments } from '../../src/lib/marketplace/commerce/payments';
async function main() {
  const schema = process.env.D4_TEST_SCHEMA;
  if (!schema || !/^d4_[a-f0-9]{24}$/.test(schema))
    throw Error('Isolated Test schema required.');
  const url = testDatabaseUrl();
  if (!url) throw Error('Test database required.');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema }),
  });
  try {
    const owner = await db.user.findFirstOrThrow({
      where: { roleAssignments: { some: { role: 'ADMIN' } } },
    });
    const fixture = providerFixture(),
      service = new CommercePayments(db, fixture.gateway);
    const result: Record<
      string,
      { ref: string; intentRef: string; slug: string }
    > = {};
    for (const state of [
      'ready',
      'pending',
      'failed',
      'paid',
      'review',
      'refunded',
    ]) {
      const purchase = await readyPurchase(db, owner.id),
        order = await purchase.order();
      if (state !== 'ready') {
        const session = await service.open(order.ref, owner.id),
          id = String(session.data.providerOrderId);
        if (state !== 'pending') {
          fixture.payment(
            id,
            state === 'failed' ? { status: 'failed', captured: false } : {},
          );
          if (state === 'review') fixture.sessions.get(id)!.currency = 'USD';
          await service.reconcile(order.ref, owner.id);
          if (state === 'refunded') {
            fixture.payment(id, {
              status: 'refunded',
              amount_refunded: purchase.intent.quote.priceMinor,
            });
            await service.reconcile(order.ref, owner.id);
          }
        }
      }
      result[state] = {
        ref: order.ref,
        intentRef: purchase.intent.ref,
        slug: purchase.offering.slug,
      };
    }
    await db.adminAuthorization.update({
      where: { userId: owner.id },
      data: {
        permissions: ['MARKETPLACE_MANAGE', 'COMMERCE_VIEW', 'COMMERCE_MANAGE'],
      },
    });
    console.info(JSON.stringify(result));
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'M4 isolated browser fixture setup failed; private details withheld.',
  );
  process.exitCode = 1;
});
