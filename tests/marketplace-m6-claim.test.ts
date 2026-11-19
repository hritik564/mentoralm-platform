import 'next/dist/server/node-environment-baseline';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import { m6Flow } from './helpers/marketplace-m6';
import { EnrollmentService } from '../src/lib/marketplace/enrollment/service';

test('M6 cross-browser anonymous claims converge on the existing compatible owned Intent without overwriting onboarding', async () => {
  const f = await isolatedDatabase();
  try {
    const p = await m6Flow(f.db),
      proofs = [
        randomBytes(32).toString('hex'),
        randomBytes(32).toString('hex'),
      ];
    const anonymous = await Promise.all(
      proofs.map((proof) =>
        new EnrollmentService(f.db).start(null, proof, {
          slug: p.offering.slug,
        }),
      ),
    );
    const claimed = await Promise.all(
      anonymous.map((a, i) =>
        new EnrollmentService(f.db).claim(a.ref, p.user.id, proofs[i], {
          revision: a.revision,
        }),
      ),
    );
    assert.ok(claimed.every((c) => c.ref === p.intent.ref));
    assert.equal(
      await f.db.marketplaceEnrollmentIntent.count({
        where: {
          userId: p.user.id,
          offeringId: p.offering.id,
          state: { in: ['ONBOARDING_REQUIRED', 'READY_FOR_CHECKOUT'] },
        },
      }),
      1,
    );
    assert.equal(claimed[0].values.goal, p.intent.values.goal);
    // Response loss, refresh and duplicate claim still recover the same owned canonical Intent.
    for (const a of anonymous) {
      assert.equal(
        (
          await p.intents.claim(a.ref, p.user.id, null, {
            revision: a.revision,
          })
        ).ref,
        p.intent.ref,
      );
      assert.equal(
        (await p.intents.view(a.ref, p.user.id, null)).ref,
        p.intent.ref,
      );
    }
  } finally {
    await f.cleanup();
  }
});

test('M6 full refund and repurchase reuse immutable learner ID/history with a fresh financial intent', async () => {
  const f = await isolatedDatabase();
  try {
    const { CommercePayments } =
      await import('../src/lib/marketplace/commerce/payments');
    const { CommerceOrders } =
      await import('../src/lib/marketplace/commerce/orders');
    const { MarketplaceDeliveryService } =
      await import('../src/lib/marketplace/delivery/service');
    const { m6Steps } = await import('./helpers/marketplace-m6');
    const p = await m6Flow(f.db, { role: 'INSTRUCTOR' }),
      first = await p.pay(),
      delivery = new MarketplaceDeliveryService(f.db);
    await p.payments.reconcile(first.order.ref, p.user.id);
    await delivery.reconcile({ ownerId: p.user.id });
    const identity = await f.db.user.findUniqueOrThrow({
        where: { id: p.user.id },
      }),
      enrollment = await f.db.enrollment.findFirstOrThrow({
        where: { userId: p.user.id },
      });
    p.provider.payment(first.sessionId, {
      status: 'refunded',
      amount_refunded: p.intent.quote.priceMinor,
    });
    await p.payments.reconcile(first.order.ref, p.user.id);
    await delivery.reconcile({ ownerId: p.user.id });
    let next = await p.intents.start(p.user.id, p.proof, {
      slug: p.offering.slug,
    });
    assert.notEqual(next.ref, p.intent.ref);
    for (const step of m6Steps)
      next = await p.intents.saveStep(next.ref, p.user.id, {
        ...step,
        revision: next.revision,
      });
    const order = await new CommerceOrders(f.db).create(
        p.user.id,
        {
          intentRef: next.ref,
          revision: next.revision,
          termsVersion: p.policy.version,
          acknowledge: true,
        },
        p.policy,
      ),
      payments = new CommercePayments(f.db, p.provider.gateway),
      session = await payments.open(order.ref, p.user.id);
    p.provider.payment(String(session.data.providerOrderId));
    await payments.reconcile(order.ref, p.user.id);
    await delivery.reconcile({ ownerId: p.user.id });
    assert.equal(
      (await f.db.user.findUniqueOrThrow({ where: { id: p.user.id } }))
        .studentId,
      identity.studentId,
    );
    assert.equal(
      await f.db.marketplaceLearnerIdentity.count({
        where: { userId: p.user.id },
      }),
      1,
    );
    assert.deepEqual(
      await f.db.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
      enrollment,
    );
    assert.equal(
      await f.db.marketplaceEntitlement.count({
        where: { userId: p.user.id, status: 'ACTIVE' },
      }),
      1,
    );
    assert.equal(
      await f.db.marketplaceOrder.count({ where: { userId: p.user.id } }),
      2,
    );
  } finally {
    await f.cleanup();
  }
});
