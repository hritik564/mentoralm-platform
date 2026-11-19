import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { testDatabaseUrl } from './d4-database';
import { m5Purchase } from './marketplace-m5';
import { MarketplaceDeliveryService } from '../../src/lib/marketplace/delivery/service';
async function main() {
  const schema = process.env.D4_TEST_SCHEMA,
    url = testDatabaseUrl();
  if (!url || !schema || !/^d4_[a-f0-9]{24}$/.test(schema))
    throw Error('Isolated Test schema required.');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema }),
  });
  try {
    const owner = await db.user.findFirstOrThrow({
      where: { roleAssignments: { some: { role: 'ADMIN' } } },
    });
    await db.user.update({
      where: { id: owner.id },
      data: { role: 'INSTRUCTOR', lmsAccessOverride: null },
    });
    const service = new MarketplaceDeliveryService(db),
      result: Record<
        string,
        {
          orderRef: string;
          deliveryRef: string;
          courseId: string | null;
          slug: string;
          title: string;
        }
      > = {};
    for (const state of [
      'active',
      'pending',
      'failed',
      'review',
      'external',
      'refunded',
    ]) {
      const p = await m5Purchase(db, {
        lms: state !== 'external',
        userId: owner.id,
        title: `M5 ${state} program`,
      });
      if (state === 'active' || state === 'refunded')
        await service.run(p.delivery.publicRef, p.authority);
      if (state === 'pending')
        await db.marketplaceDelivery.update({
          where: { id: p.delivery.id },
          data: {
            status: 'PROVISIONING',
            attemptCount: 1,
            lastAttemptAt: new Date(),
          },
        });
      if (state === 'failed')
        await new MarketplaceDeliveryService(
          db,
          () => new Date(),
          async () => {
            throw Error('synthetic temporary provisioning failure');
          },
        ).run(p.delivery.publicRef, p.authority);
      if (state === 'review') {
        await db.course.update({
          where: { id: p.course!.id },
          data: { published: false },
        });
        await service.run(p.delivery.publicRef, p.authority);
      }
      if (state === 'refunded') {
        p.provider.payment(p.providerOrder, {
          status: 'refunded',
          amount_refunded: p.intent.quote.priceMinor,
        });
        await p.payments.reconcile(p.order.ref, owner.id);
      }
      result[state] = {
        orderRef: p.order.ref,
        deliveryRef: p.delivery.publicRef,
        courseId: p.course?.id || null,
        slug: p.offering.slug,
        title: p.offering.title,
      };
    }
    await m5Purchase(db, { title: 'Another customer private purchase' });
    await db.adminAuthorization.update({
      where: { userId: owner.id },
      data: {
        permissions: ['MARKETPLACE_MANAGE', 'COMMERCE_VIEW', 'DELIVERY_MANAGE'],
      },
    });
    console.info(JSON.stringify(result));
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'M5 isolated browser fixture failed; private details withheld.',
  );
  process.exitCode = 1;
});
