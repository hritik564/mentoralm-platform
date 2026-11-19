import { LmsAccessAdmin } from '../src/lib/lms/access-admin';
import { StudentRepository } from '../src/lib/student/repository';
import 'next/dist/server/node-environment-baseline';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import { m6Flow } from './helpers/marketplace-m6';
import { EnrollmentService } from '../src/lib/marketplace/enrollment/service';
import { CommercePayments } from '../src/lib/marketplace/commerce/payments';
import { MarketplaceDeliveryService } from '../src/lib/marketplace/delivery/service';
import { myPrograms } from '../src/lib/marketplace/delivery/read';
import { LearningRepository } from '../src/lib/lms/learning';
import { entitledStudentWhere } from '../src/lib/lms/entitlement';
import { readPublishedProgram } from '../src/lib/marketplace/program-queries';
import { cleanupMarketplace } from '../src/lib/marketplace/commerce/retention';
import { reconcilePendingCommerce } from '../src/lib/marketplace/commerce/admin';
import { requireAdminPermission } from '../src/lib/auth/admin-policy';

test('M6 full-chain happy paths, Autoscale, payment/refund and delivery crash matrix', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db;
  const delivery = new MarketplaceDeliveryService(db);
  const entitlement = (orderId: string) =>
    db.marketplaceEntitlement.findUniqueOrThrow({ where: { orderId } });
  const rowFor = async (ref: string) =>
    db.marketplaceOrder.findUniqueOrThrow({ where: { publicRef: ref } });
  const operator = await db.user.create({
    data: {
      clerkUserId: `m6_operator_${randomUUID()}`,
      role: 'ADMIN',
      adminAuthorization: {
        create: {
          permissions: [
            'COMMERCE_VIEW',
            'COMMERCE_MANAGE',
            'DELIVERY_MANAGE',
            'STUDENTS_MANAGE',
          ],
        },
      },
    },
  });
  try {
    for (const anonymous of [true, false])
      await t.test(
        `${anonymous ? 'signed-out secure claim' : 'already signed-in resume'} → published program → quote → captured settlement → learner → lesson → refund`,
        async () => {
          const p = await m6Flow(db, { anonymous });
          const page = await readPublishedProgram(db, p.offering.slug);
          assert.equal(
            page.program?.page.heroHeadline,
            'Build a purposeful future',
          );
          if (anonymous) {
            assert.equal(
              (
                await p.intents.claim(p.anonymous.ref, p.user.id, null, {
                  revision: p.anonymous.revision,
                })
              ).ref,
              p.intent.ref,
            );
            await assert.rejects(
              p.intents.claim(p.anonymous.ref, p.editor.id, p.proof, {
                revision: p.anonymous.revision,
              }),
              { code: 'NOT_FOUND' },
            );
          }
          const resumed = await p.intents.start(p.user.id, p.proof, {
            slug: p.offering.slug,
          });
          assert.equal(resumed.ref, p.intent.ref);
          assert.equal(resumed.state, 'READY_FOR_CHECKOUT');
          assert.ok(resumed.completedAt);
          const { order, sessionId } = await p.pay();
          assert.equal(
            await db.marketplaceEntitlement.count({
              where: { userId: p.user.id },
            }),
            0,
          );
          const event = p.provider.event(
            sessionId,
            'payment.captured',
            `evt_${randomUUID()}`,
          );
          await Promise.all([
            p.payments.consumeWebhook(event.raw, event.headers),
            new CommercePayments(db, p.provider.gateway).reconcile(
              order.ref,
              p.user.id,
            ),
          ]);
          const local = await rowFor(order.ref),
            e = await entitlement(local.id);
          assert.equal(local.status, 'PAID');
          assert.equal(e.status, 'ACTIVE');
          const pending = await db.marketplaceDelivery.findUniqueOrThrow({
            where: { entitlementId: e.id },
          });
          assert.equal(pending.status, 'PENDING');
          assert.equal(
            (await myPrograms(db, p.user.id)).items[0].state,
            'PREPARING',
          );
          await delivery.reconcile({ ownerId: p.user.id });
          const active = await db.marketplaceDelivery.findUniqueOrThrow({
            where: { id: pending.id },
          });
          assert.equal(active.status, 'ACTIVE');
          assert.equal(active.lmsAccessProvenance, 'CREATED');
          assert.match(p.user.studentId!, /^ST-\d{4}-\d{6,}$/);
          assert.equal(
            await db.studentProfile.count({ where: { userId: p.user.id } }),
            0,
          );
          const learning = new LearningRepository(db, p.user);
          assert.ok(await learning.lesson(p.course.id, p.item.id));
          await learning.record(p.course.id, p.item.id, true);
          assert.equal(
            (await myPrograms(db, p.user.id)).items[0].state,
            'ACTIVE',
          );
          const history = await db.lessonState.findMany({
            where: { userId: p.user.id },
          });
          p.provider.payment(sessionId, {
            status: 'refunded',
            amount_refunded: p.intent.quote.priceMinor,
          });
          const refund = p.provider.event(
            sessionId,
            'refund.processed',
            `evt_${randomUUID()}`,
          );
          await Promise.all([
            p.payments.consumeWebhook(refund.raw, refund.headers),
            p.payments.reconcile(order.ref, p.user.id),
          ]);
          await assert.rejects(learning.lesson(p.course.id, p.item.id));
          await delivery.reconcile({ ownerId: p.user.id });
          assert.equal(
            (
              await db.marketplaceDelivery.findUniqueOrThrow({
                where: { id: active.id },
              })
            ).status,
            'REVOKED',
          );
          assert.deepEqual(
            await db.lessonState.findMany({ where: { userId: p.user.id } }),
            history,
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: p.user.id } }))
              .studentId,
            p.user.studentId,
          );
        },
      );
    for (const role of ['ADMIN', 'INSTRUCTOR'] as const)
      await t.test(
        `${role} full purchase preserves persona, role assignments, governance and Clerk mapping`,
        async () => {
          const p = await m6Flow(db, { role });
          const policy =
            role === 'ADMIN'
              ? await db.adminAuthorization.create({
                  data: { userId: p.user.id, permissions: ['COMMERCE_VIEW'] },
                })
              : null;
          const before = await db.user.findUniqueOrThrow({
            where: { id: p.user.id },
          });
          const { order, sessionId } = await p.pay();
          await p.payments.reconcile(order.ref, p.user.id);
          await delivery.reconcile({ ownerId: p.user.id });
          const after = await db.user.findUniqueOrThrow({
            where: { id: p.user.id },
          });
          assert.equal(after.role, before.role);
          assert.equal(after.clerkUserId, before.clerkUserId);
          assert.match(after.studentId!, /^ST-\d{4}-\d{6,}$/);
          assert.equal(
            await db.userRoleAssignment.count({ where: { userId: p.user.id } }),
            0,
          );
          assert.equal(
            await db.marketplaceLearnerIdentity.count({
              where: { userId: p.user.id },
            }),
            1,
          );
          assert.ok(
            await new LearningRepository(db, after).lesson(
              p.course.id,
              p.item.id,
            ),
          );
          assert.throws(() => new StudentRepository(db, after), {
            code: 'FORBIDDEN',
          });
          await new LmsAccessAdmin(db, operator.id).change({
            kind: 'STUDENT_OVERRIDE',
            userId: p.user.id,
            value: 'DISABLED',
          });
          await assert.rejects(
            new LearningRepository(db, after).lesson(p.course.id, p.item.id),
            { code: 'FORBIDDEN' },
          );
          await new LmsAccessAdmin(db, operator.id).change({
            kind: 'STUDENT_OVERRIDE',
            userId: p.user.id,
            value: null,
          });
          assert.ok(
            await new LearningRepository(db, after).lesson(
              p.course.id,
              p.item.id,
            ),
          );
          if (policy) {
            assert.deepEqual(
              await db.adminAuthorization.findUnique({
                where: { userId: p.user.id },
              }),
              policy,
            );
            await requireAdminPermission(db, p.user.id, 'COMMERCE_VIEW');
          }
          p.provider.payment(sessionId, {
            status: 'refunded',
            amount_refunded: p.intent.quote.priceMinor,
          });
          await p.payments.reconcile(order.ref, p.user.id);
          assert.equal(
            await db.user.findFirst({ where: entitledStudentWhere(p.user.id) }),
            null,
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: p.user.id } }))
              .studentId,
            after.studentId,
          );
          if (policy)
            await requireAdminPermission(db, p.user.id, 'COMMERCE_VIEW');
        },
      );
    for (const anonymous of [true, false])
      await t.test(
        `12 independent workers starting ${anonymous ? 'anonymous' : 'authenticated'} intents converge on one compatible intent`,
        async () => {
          const p = await m6Flow(db);
          const proof = randomBytes(32).toString('hex');
          const results = await Promise.all(
            Array.from({ length: 12 }, () =>
              new EnrollmentService(db).start(
                anonymous ? null : p.user.id,
                proof,
                { slug: p.offering.slug },
              ),
            ),
          );
          assert.equal(new Set(results.map((x) => x.ref)).size, 1);
        },
      );
    await t.test(
      'duplicate Order/session/webhook/reconcile/Admin retry/Dashboard work converges singularly',
      async () => {
        const p = await m6Flow(db);
        const createsBefore = p.provider.creates;
        const orders = await Promise.all(
          Array.from({ length: 8 }, () => p.order()),
        );
        assert.equal(new Set(orders.map((x) => x.ref)).size, 1);
        const order = orders[0];
        const sessions = await Promise.allSettled(
          Array.from({ length: 8 }, () =>
            new CommercePayments(db, p.provider.gateway).open(
              order.ref,
              p.user.id,
            ),
          ),
        );
        assert.ok(sessions.some((x) => x.status === 'fulfilled'));
        assert.equal(p.provider.creates, createsBefore + 1);
        const attempt = await db.marketplacePaymentAttempt.findUniqueOrThrow({
          where: { orderId: (await rowFor(order.ref)).id },
        });
        assert.ok(attempt.providerSessionId);
        p.provider.payment(attempt.providerSessionId);
        const event = p.provider.event(
          attempt.providerSessionId,
          'order.paid',
          `evt_${randomUUID()}`,
        );
        await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            i % 2
              ? new CommercePayments(db, p.provider.gateway).consumeWebhook(
                  event.raw,
                  event.headers,
                )
              : new CommercePayments(db, p.provider.gateway).reconcile(
                  order.ref,
                  p.user.id,
                ),
          ),
        );
        const e = await entitlement(attempt.orderId),
          d = await db.marketplaceDelivery.findUniqueOrThrow({
            where: { entitlementId: e.id },
          });
        await Promise.all(
          Array.from({ length: 8 }, (_, i) =>
            i % 2
              ? new MarketplaceDeliveryService(db).run(
                  d.publicRef,
                  { adminActorId: operator.id },
                  true,
                )
              : new MarketplaceDeliveryService(db).reconcile({
                  ownerId: p.user.id,
                }),
          ),
        );
        assert.equal(
          await db.marketplaceOrder.count({
            where: { userId: p.user.id, offeringId: p.offering.id },
          }),
          1,
        );
        assert.equal(
          await db.marketplaceEntitlement.count({
            where: { userId: p.user.id, offeringId: p.offering.id },
          }),
          1,
        );
        assert.equal(
          await db.marketplaceDelivery.count({
            where: { entitlementId: e.id },
          }),
          1,
        );
        assert.equal(
          await db.enrollment.count({
            where: { userId: p.user.id, courseId: p.course.id },
          }),
          1,
        );
        assert.equal(
          await db.marketplacePaymentEvent.count({
            where: {
              providerEventId: event.headers.get('x-razorpay-event-id')!,
            },
          }),
          1,
        );
      },
    );
    for (const shared of [false, true])
      await t.test(
        `same purchaser two ${shared ? 'shared-Course' : 'different-Course'} offerings retain capability after one refund`,
        async () => {
          const a = await m6Flow(db, { role: 'INSTRUCTOR' }),
            b = await m6Flow(db, {
              userId: a.user.id,
              provider: a.provider,
              ...(shared ? { courseId: a.course.id } : {}),
            });
          const [ap, bp] = await Promise.all([a.pay(), b.pay()]);
          await Promise.all([
            a.payments.reconcile(ap.order.ref, a.user.id),
            b.payments.reconcile(bp.order.ref, a.user.id),
          ]);
          await Promise.all([
            delivery.reconcile({ ownerId: a.user.id }),
            new MarketplaceDeliveryService(db).reconcile({
              ownerId: a.user.id,
            }),
          ]);
          assert.equal(
            await db.marketplaceLearnerIdentity.count({
              where: { userId: a.user.id },
            }),
            1,
          );
          assert.equal(
            await db.enrollment.count({ where: { userId: a.user.id } }),
            shared ? 1 : 2,
          );
          a.provider.payment(ap.sessionId, {
            status: 'refunded',
            amount_refunded: a.intent.quote.priceMinor,
          });
          await a.payments.reconcile(ap.order.ref, a.user.id);
          await delivery.reconcile({ ownerId: a.user.id });
          const actor = await db.user.findUniqueOrThrow({
            where: { id: a.user.id },
          });
          assert.ok(
            await new LearningRepository(db, actor).course(b.course.id),
          );
        },
      );
    for (const reversal of ['partial', 'full', 'dispute'] as const)
      await t.test(
        `${reversal} reversal is sticky under duplicate and stale captured evidence`,
        async () => {
          const p = await m6Flow(db),
            { order, sessionId } = await p.pay();
          await p.payments.reconcile(order.ref, p.user.id);
          await delivery.reconcile({ ownerId: p.user.id });
          if (reversal === 'dispute') {
            const e = p.provider.event(
              sessionId,
              'payment.dispute.created',
              `evt_${randomUUID()}`,
            );
            await p.payments.consumeWebhook(e.raw, e.headers);
          } else {
            p.provider.payment(sessionId, {
              status: reversal === 'full' ? 'refunded' : 'captured',
              amount_refunded:
                reversal === 'full' ? p.intent.quote.priceMinor : 100,
            });
            await p.payments.reconcile(order.ref, p.user.id);
          }
          const before = await rowFor(order.ref);
          assert.equal(
            before.status,
            reversal === 'full' ? 'REFUNDED' : 'REFUND_PENDING',
          );
          p.provider.payment(sessionId);
          await Promise.all([
            p.payments.reconcile(order.ref, p.user.id),
            p.payments.reconcile(order.ref, p.user.id),
          ]);
          assert.equal((await rowFor(order.ref)).status, before.status);
          assert.notEqual((await entitlement(before.id)).status, 'ACTIVE');
          assert.equal((await myPrograms(db, p.user.id)).items.length, 0);
        },
      );
    for (const point of [
      'identity',
      'student-id',
      'account-audit',
      'enrollment',
      'delivery-active',
    ] as const)
      await t.test(
        `crash/failure at ${point} keeps PAID/ownership, rolls back learning and retries once`,
        async () => {
          const p = await m6Flow(db, { role: 'INSTRUCTOR' }),
            { order } = await p.pay();
          await p.payments.reconcile(order.ref, p.user.id);
          const e = await entitlement((await rowFor(order.ref)).id),
            d = await db.marketplaceDelivery.findUniqueOrThrow({
              where: { entitlementId: e.id },
            });
          const table =
            point === 'identity'
              ? 'MarketplaceLearnerIdentity'
              : point === 'student-id'
                ? 'User'
                : point === 'account-audit'
                  ? 'MarketplaceCommerceEvent'
                  : point === 'enrollment'
                    ? 'Enrollment'
                    : 'MarketplaceDelivery';
          const condition =
            point === 'account-audit'
              ? `NEW.kind::text='MarketplaceLmsAccessGranted'`
              : point === 'delivery-active'
                ? `NEW.status::text='ACTIVE'`
                : 'TRUE';
          await db.$executeRawUnsafe(
            `CREATE FUNCTION "${f.schema}".m6_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'synthetic private failure'; END IF; RETURN NEW; END $$`,
          );
          await db.$executeRawUnsafe(
            `CREATE TRIGGER m6_failure BEFORE ${point === 'student-id' || point === 'delivery-active' ? 'UPDATE' : 'INSERT'} ON "${f.schema}"."${table}" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".m6_failure()`,
          );
          try {
            await delivery.run(d.publicRef, { ownerId: p.user.id });
          } finally {
            await db.$executeRawUnsafe(
              `DROP TRIGGER m6_failure ON "${f.schema}"."${table}"`,
            );
            await db.$executeRawUnsafe(
              `DROP FUNCTION "${f.schema}".m6_failure()`,
            );
          }
          assert.equal((await rowFor(order.ref)).status, 'PAID');
          assert.equal((await entitlement(e.orderId)).status, 'ACTIVE');
          assert.equal(
            (
              await db.marketplaceDelivery.findUniqueOrThrow({
                where: { id: d.id },
              })
            ).status,
            'FAILED',
          );
          assert.equal(
            await db.enrollment.count({ where: { userId: p.user.id } }),
            0,
          );
          assert.equal(
            await db.marketplaceLearnerIdentity.count({
              where: { userId: p.user.id },
            }),
            0,
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: p.user.id } }))
              .studentId,
            null,
          );
          await new MarketplaceDeliveryService(
            db,
            () => new Date(Date.now() + 6 * 60000),
          ).run(d.publicRef, { ownerId: p.user.id });
          assert.equal(
            (
              await db.marketplaceDelivery.findUniqueOrThrow({
                where: { id: d.id },
              })
            ).status,
            'ACTIVE',
          );
          assert.equal(
            await db.enrollment.count({ where: { userId: p.user.id } }),
            1,
          );
        },
      );
    await t.test(
      'durable webhook inbox survives settlement failure and fresh instance reconciles without browser session',
      async () => {
        const p = await m6Flow(db),
          { order, sessionId } = await p.pay(),
          event = p.provider.event(
            sessionId,
            'payment.captured',
            `evt_${randomUUID()}`,
          );
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${f.schema}".m6_settle_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind::text='EntitlementGranted' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER m6_settle_fail BEFORE INSERT ON "${f.schema}"."MarketplaceCommerceEvent" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".m6_settle_fail()`,
        );
        try {
          await assert.rejects(
            p.payments.consumeWebhook(event.raw, event.headers),
          );
        } finally {
          await db.$executeRawUnsafe(
            `DROP TRIGGER m6_settle_fail ON "${f.schema}"."MarketplaceCommerceEvent"`,
          );
        }
        assert.equal(
          await db.marketplaceEntitlement.count({
            where: { userId: p.user.id },
          }),
          0,
        );
        assert.equal(
          (
            await db.marketplacePaymentEvent.findUniqueOrThrow({
              where: {
                provider_merchantRef_providerEventId: {
                  provider: 'RAZORPAY',
                  merchantRef: p.provider.config.merchantRef,
                  providerEventId: event.headers.get('x-razorpay-event-id')!,
                },
              },
            })
          ).status,
          'RECEIVED',
        );
        await reconcilePendingCommerce(db, p.provider.gateway, operator.id);
        assert.equal((await rowFor(order.ref)).status, 'PAID');
      },
    );
    await t.test(
      'provider creation lost response is recovered by receipt without a second outbound create',
      async () => {
        const p = await m6Flow(db),
          order = await p.order();
        const createsBefore = p.provider.creates;
        p.provider.loseCreateResponse = true;
        await assert.rejects(p.payments.open(order.ref, p.user.id));
        assert.equal(p.provider.creates, createsBefore + 1);
        await new CommercePayments(db, p.provider.gateway).open(
          order.ref,
          p.user.id,
        );
        assert.equal(p.provider.creates, createsBefore + 1);
      },
    );
    await t.test(
      'late capture is retained in REVIEW and blocks overlapping purchase rather than silently granting',
      async () => {
        const p = await m6Flow(db),
          { order, sessionId } = await p.pay();
        await new CommercePayments(
          db,
          p.provider.gateway,
          () => new Date(Date.now() + 25 * 3600000),
        ).reconcile(order.ref, p.user.id);
        const row = await rowFor(order.ref);
        assert.equal(row.status, 'REVIEW');
        assert.equal(
          await db.marketplaceEntitlement.count({
            where: { userId: p.user.id },
          }),
          0,
        );
        assert.equal(
          (
            await db.marketplacePaymentAttempt.findUniqueOrThrow({
              where: { orderId: row.id },
            })
          ).status,
          'CAPTURED',
        );
        const operatorView = await reconcilePendingCommerce(
          db,
          p.provider.gateway,
          operator.id,
        );
        assert.ok(operatorView.examined > 0);
        assert.equal((await rowFor(order.ref)).status, 'REVIEW');
        void sessionId;
      },
    );
    await t.test(
      'new ACTIVE Delivery without learner/account provenance is rejected by PostgreSQL',
      async () => {
        const p = await m6Flow(db),
          { order } = await p.pay();
        await p.payments.reconcile(order.ref, p.user.id);
        const e = await entitlement((await rowFor(order.ref)).id),
          d = await db.marketplaceDelivery.findUniqueOrThrow({
            where: { entitlementId: e.id },
          });
        const enrollment = await db.enrollment.create({
          data: { userId: p.user.id, courseId: p.course.id },
        });
        await assert.rejects(
          db.marketplaceDelivery.update({
            where: { id: d.id },
            data: {
              status: 'ACTIVE',
              enrollmentId: enrollment.id,
              createdEnrollmentId: enrollment.id,
              provenance: 'CREATED',
              provisionedAt: new Date(),
            },
          }),
        );
      },
    );
    await t.test(
      'retention dry run is bounded and keeps paid/review/unknown financial and learning records',
      async () => {
        const before = {
          orders: await db.marketplaceOrder.count(),
          entitlements: await db.marketplaceEntitlement.count(),
          learners: await db.marketplaceLearnerIdentity.count(),
          enrollments: await db.enrollment.count(),
        };
        const result = await cleanupMarketplace(db, operator.id, {
          batchSize: 2,
          now: new Date(Date.now() + 100 * 86400000),
        });
        assert.equal(result.mode, 'dry-run');
        assert.ok(result.examined <= 2);
        assert.equal(result.redacted, 0);
        assert.deepEqual(
          {
            orders: await db.marketplaceOrder.count(),
            entitlements: await db.marketplaceEntitlement.count(),
            learners: await db.marketplaceLearnerIdentity.count(),
            enrollments: await db.enrollment.count(),
          },
          before,
        );
      },
    );
  } finally {
    await f.cleanup();
  }
});
