import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { readyPurchase } from './marketplace-m4';
import { providerFixture } from './marketplace-m4-provider';
import { CommercePayments } from '../../src/lib/marketplace/commerce/payments';
// One injected merchant transport per isolated database, mirroring a provider's shared remote state.
const providers = new WeakMap<
  PrismaClient,
  ReturnType<typeof providerFixture>
>();
export async function m5Purchase(
  db: PrismaClient,
  options: {
    lms?: boolean;
    userId?: string;
    courseId?: string;
    title?: string;
  } = {},
) {
  const user = options.userId
    ? await db.user.findUniqueOrThrow({ where: { id: options.userId } })
    : await db.user.create({
        data: {
          clerkUserId: `m5_fixture_${randomUUID()}`,
          lmsAccessOverride: 'ENABLED',
        },
      });
  const p = await readyPurchase(db, user.id, options.title),
    provider = providers.get(db) || providerFixture(),
    payments = new CommercePayments(db, provider.gateway);
  const course = options.lms
    ? options.courseId
      ? await db.course.findUniqueOrThrow({ where: { id: options.courseId } })
      : await db.course.create({
          data: {
            title: 'M5 practical learning',
            description: 'Guided practical learning',
            thumbnailPath: '/images/campus.webp',
            thumbnailAlt: 'Campus',
            publicPath: '/#programs',
            published: true,
          },
        })
    : null;
  if (course)
    await db.marketplaceOffering.update({
      where: { id: p.offering.id },
      data: { lmsEnabled: true, courseId: course.id },
    });
  providers.set(db, provider);
  const order = await p.order(),
    checkout = await payments.open(order.ref, user.id),
    providerOrder = String(checkout.data.providerOrderId);
  provider.payment(providerOrder);
  await payments.reconcile(order.ref, user.id);
  const entitlement = await db.marketplaceEntitlement.findUniqueOrThrow({
    where: {
      orderId: (
        await db.marketplaceOrder.findUniqueOrThrow({
          where: { publicRef: order.ref },
        })
      ).id,
    },
  });
  const delivery = await db.marketplaceDelivery.findUniqueOrThrow({
    where: { entitlementId: entitlement.id },
  });
  return {
    user,
    course,
    ...p,
    provider,
    payments,
    providerOrder,
    order,
    entitlement,
    delivery,
    authority: { ownerId: user.id },
  };
}
