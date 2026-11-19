import { readyPurchase } from './helpers/marketplace-m4';
import { providerFixture } from './helpers/marketplace-m4-provider';
import { CommercePayments } from '../src/lib/marketplace/commerce/payments';
import { CustomerSupportRepository } from '../src/lib/student/support';
import { StudentRepository } from '../src/lib/student/repository';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase, testDatabaseUrl } from './helpers/d4-database';
import { m5Purchase } from './helpers/marketplace-m5';
import { MarketplaceDeliveryService } from '../src/lib/marketplace/delivery/service';
import { myPrograms } from '../src/lib/marketplace/delivery/read';
import { CommerceAdmin } from '../src/lib/marketplace/commerce/admin';
import { LearningRepository } from '../src/lib/lms/learning';
import { migrationManifest } from '../src/lib/production/migrations';
import {
  requireMarketplaceDeliveryBaseline,
  requireMarketplaceCommerceBaseline,
} from '../scripts/marketplace/safety';
const directory = { search: async () => [], lookup: async () => new Map() };
test('M5 Admin policy, bounded recovery, lease and audit safety', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db,
    service = new MarketplaceDeliveryService(db);
  try {
    async function staff(
      permissions: (
        | 'COMMERCE_VIEW'
        | 'COMMERCE_MANAGE'
        | 'DELIVERY_MANAGE'
        | 'ACADEMICS_MANAGE'
        | 'MARKETPLACE_MANAGE'
      )[],
    ) {
      return db.user.create({
        data: {
          clerkUserId: `m5_staff_${randomUUID()}`,
          role: 'ADMIN',
          adminAuthorization: { create: { permissions } },
        },
      });
    }
    const p = await m5Purchase(db, { lms: true }),
      operator = await staff(['COMMERCE_VIEW', 'DELIVERY_MANAGE']);
    await t.test(
      'financial viewer, finance manager, catalogue and academic staff cannot retry delivery',
      async () => {
        for (const permissions of [
          ['COMMERCE_VIEW'],
          ['COMMERCE_VIEW', 'COMMERCE_MANAGE'],
          ['MARKETPLACE_MANAGE'],
          ['ACADEMICS_MANAGE'],
          ['DELIVERY_MANAGE'],
        ] as Parameters<typeof staff>[0][]) {
          const admin = await staff(permissions);
          await assert.rejects(
            service.run(p.delivery.publicRef, { adminActorId: admin.id }, true),
            { code: 'FORBIDDEN' },
          );
        }
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: p.delivery.id },
            })
          ).attemptCount,
          0,
        );
      },
    );
    await t.test(
      'authorized retry uses canonical service; financial detail projects safe delivery metadata',
      async () => {
        await service.run(
          p.delivery.publicRef,
          { adminActorId: operator.id },
          true,
        );
        const detail = await new CommerceAdmin(
          db,
          operator.id,
          directory,
        ).detail(p.order.ref);
        assert.equal(detail.delivery?.status, 'ACTIVE');
        assert.equal(detail.delivery.provenance, 'CREATED');
        assert.equal(detail.delivery.attemptCount, 1);
        assert.ok(!JSON.stringify(detail.delivery).includes('enrollmentId'));
      },
    );
    await t.test(
      'Student identity and ID are reused, no profiles/roles/Batch assignments are mutated',
      async () => {
        const before = await db.user.findUniqueOrThrow({
          where: { id: p.user.id },
        });
        await service.run(p.delivery.publicRef, p.authority);
        assert.deepEqual(
          await db.user.findUnique({ where: { id: p.user.id } }),
          before,
        );
        assert.match(before.studentId!, /^ST-\d{4}-\d{6}$/);
        assert.equal(
          await db.userRoleAssignment.count({ where: { userId: p.user.id } }),
          0,
        );
        assert.equal(
          await db.studentProfile.count({ where: { userId: p.user.id } }),
          0,
        );
      },
    );
    await t.test(
      'permission revoked after claim cannot provision and stale lease can be recovered by another authority',
      async () => {
        const q = await m5Purchase(db, { lms: true }),
          actor = await staff(['COMMERCE_VIEW', 'DELIVERY_MANAGE']);
        await assert.rejects(
          new MarketplaceDeliveryService(
            db,
            () => new Date(),
            async () => {
              await db.adminAuthorization.update({
                where: { userId: actor.id },
                data: { permissions: ['COMMERCE_VIEW'] },
              });
            },
          ).run(q.delivery.publicRef, { adminActorId: actor.id }, true),
          { code: 'FORBIDDEN' },
        );
        assert.equal(
          await db.enrollment.count({ where: { userId: q.user.id } }),
          0,
        );
        const later = new MarketplaceDeliveryService(
          db,
          () => new Date(Date.now() + 11 * 60000),
        );
        await later.reconcile(q.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: q.delivery.id },
            })
          ).status,
          'ACTIVE',
        );
      },
    );
    await t.test(
      'refund during claimed work defeats the lease and cannot create Enrollment',
      async () => {
        const q = await m5Purchase(db, { lms: true });
        await new MarketplaceDeliveryService(
          db,
          () => new Date(),
          async () => {
            q.provider.payment(q.providerOrder, {
              status: 'refunded',
              amount_refunded: q.intent.quote.priceMinor,
            });
            await q.payments.reconcile(q.order.ref, q.user.id);
          },
        ).run(q.delivery.publicRef, q.authority);
        assert.equal(
          await db.enrollment.count({ where: { userId: q.user.id } }),
          0,
        );
        await service.reconcile(q.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: q.delivery.id },
            })
          ).status,
          'REVOKED',
        );
        assert.equal(
          (await q.payments.view(q.order.ref, q.user.id)).status,
          'REFUNDED',
        );
      },
    );
    await t.test(
      'permanent review is not retried automatically; authorized retry revalidates repaired business prerequisites',
      async () => {
        const q = await m5Purchase(db, { lms: true });
        await db.user.update({
          where: { id: q.user.id },
          data: { lmsAccessOverride: 'DISABLED' },
        });
        await service.run(q.delivery.publicRef, q.authority);
        const review = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: q.delivery.id },
        });
        assert.equal(review.status, 'REVIEW');
        await service.reconcile(q.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: q.delivery.id },
            })
          ).attemptCount,
          review.attemptCount,
        );
        await db.user.update({
          where: { id: q.user.id },
          data: { lmsAccessOverride: 'ENABLED' },
        });
        await service.run(
          q.delivery.publicRef,
          { adminActorId: operator.id },
          true,
        );
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: q.delivery.id },
            })
          ).status,
          'ACTIVE',
        );
      },
    );
    await t.test(
      'repeated failures use cooldown/three automatic attempts and preserve safe audit categories',
      async () => {
        const q = await m5Purchase(db, { lms: true });
        let now = new Date();
        const failing = new MarketplaceDeliveryService(
          db,
          () => now,
          async () => {
            throw Error('private synthetic detail');
          },
        );
        await failing.run(q.delivery.publicRef, q.authority);
        await failing.reconcile(q.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: q.delivery.id },
            })
          ).attemptCount,
          1,
        );
        for (let i = 0; i < 4; i++) {
          now = new Date(now.getTime() + 6 * 60000);
          await failing.reconcile(q.authority);
        }
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: q.delivery.id },
            })
          ).attemptCount,
          3,
        );
        const audit = await db.marketplaceCommerceEvent.findMany({
          where: { orderId: q.entitlement.orderId },
        });
        assert.ok(!JSON.stringify(audit).includes('private synthetic detail'));
        await assert.rejects(service.reconcile(q.authority, 101), {
          code: 'INVALID_INPUT',
        });
      },
    );
    await t.test(
      'provision audit failure rolls back learning work but preserves already settled payment',
      async () => {
        const q = await m5Purchase(db, { lms: true });
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${f.schema}".fail_m5_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind::text='MarketplaceDeliveryProvisioned' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER fail_m5_audit BEFORE INSERT ON "${f.schema}"."MarketplaceCommerceEvent" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".fail_m5_audit()`,
        );
        await service.run(q.delivery.publicRef, q.authority);
        assert.equal(
          await db.enrollment.count({ where: { userId: q.user.id } }),
          0,
        );
        assert.equal(
          (await q.payments.view(q.order.ref, q.user.id)).status,
          'PAID',
        );
        assert.equal(
          (await q.payments.view(q.order.ref, q.user.id)).entitlementStatus,
          'ACTIVE',
        );
        await db.$executeRawUnsafe(
          `DROP TRIGGER fail_m5_audit ON "${f.schema}"."MarketplaceCommerceEvent"`,
        );
        await service.run(
          q.delivery.publicRef,
          { adminActorId: operator.id },
          true,
        );
        assert.equal(
          await db.enrollment.count({ where: { userId: q.user.id } }),
          1,
        );
      },
    );

    await t.test(
      'stale in-flight worker is fenced after another instance completes its recovered lease',
      async () => {
        const q = await m5Purchase(db, { lms: true });
        await new MarketplaceDeliveryService(
          db,
          () => new Date(),
          async () => {
            await new MarketplaceDeliveryService(
              db,
              () => new Date(Date.now() + 11 * 60000),
            ).run(q.delivery.publicRef, q.authority);
          },
        ).run(q.delivery.publicRef, q.authority);
        const d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: q.delivery.id },
        });
        assert.equal(d.status, 'ACTIVE');
        assert.equal(d.attemptCount, 2);
        assert.equal(
          await db.enrollment.count({ where: { userId: q.user.id } }),
          1,
        );
      },
    );
    await t.test(
      'paid non-Student customer can use existing own Support without gaining Student/LMS authority',
      async () => {
        const q = await m5Purchase(db, { lms: true });
        await db.user.update({
          where: { id: q.user.id },
          data: { role: 'INSTRUCTOR' },
        });
        const support = new CustomerSupportRepository(db, { id: q.user.id });
        const ticket = await support.createTicket({
          category: 'Other',
          subject: 'Purchased access assistance',
          message: 'Please help prepare the purchased program access.',
        });
        assert.equal((await support.ticket(ticket.id)).userId, q.user.id);
        await assert.rejects(
          new CustomerSupportRepository(db, { id: p.user.id }).ticket(
            ticket.id,
          ),
          { code: 'NOT_FOUND' },
        );
        assert.throws(
          () =>
            new StudentRepository(db, { id: q.user.id, role: 'INSTRUCTOR' }),
          { code: 'FORBIDDEN' },
        );
        const outsider = await db.user.create({
          data: { clerkUserId: `nonbuyer_${randomUUID()}`, role: 'INSTRUCTOR' },
        });
        await assert.rejects(
          new CustomerSupportRepository(db, outsider).tickets(),
          { code: 'FORBIDDEN' },
        );
      },
    );

    await t.test(
      'database rejects null creator provenance and Enrollment identity rebinding',
      async () => {
        const q = await m5Purchase(db, { lms: true }),
          enrollment = await db.enrollment.create({
            data: { userId: q.user.id, courseId: q.course!.id },
          });
        await assert.rejects(
          db.marketplaceDelivery.update({
            where: { id: q.delivery.id },
            data: {
              enrollmentId: enrollment.id,
              provenance: 'CREATED',
              createdEnrollmentId: null,
            },
          }),
        );
        await service.run(q.delivery.publicRef, q.authority);
        await assert.rejects(
          db.enrollment.update({
            where: { id: enrollment.id },
            data: { userId: p.user.id },
          }),
        );
      },
    );

    await t.test(
      'missing target remains owned and only an authorized repair retry resolves configuration',
      async () => {
        const q = await m5Purchase(db, { lms: true });
        await db.marketplaceDelivery.update({
          where: { id: q.delivery.id },
          data: { courseId: null },
        });
        await service.run(q.delivery.publicRef, q.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: q.delivery.id },
            })
          ).lastErrorCode,
          'COURSE_CONFIGURATION',
        );
        assert.equal(
          (await q.payments.view(q.order.ref, q.user.id)).entitlementStatus,
          'ACTIVE',
        );
        assert.equal(
          await db.enrollment.count({ where: { userId: q.user.id } }),
          0,
        );
        await service.run(
          q.delivery.publicRef,
          { adminActorId: operator.id },
          true,
        );
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: q.delivery.id },
            })
          ).status,
          'ACTIVE',
        );
      },
    );
    await t.test(
      'repeated crashed leases stop automatically at review and cannot loop forever',
      async () => {
        const q = await m5Purchase(db, { lms: true });
        await db.marketplaceDelivery.update({
          where: { id: q.delivery.id },
          data: {
            status: 'PROVISIONING',
            attemptCount: 3,
            lastAttemptAt: new Date(Date.now() - 11 * 60000),
          },
        });
        await service.reconcile(q.authority);
        const d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: q.delivery.id },
        });
        assert.equal(d.status, 'REVIEW');
        assert.equal(d.lastErrorCode, 'RETRY_LIMIT');
        assert.equal(d.attemptCount, 3);
        await service.reconcile(q.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: q.delivery.id },
            })
          ).attemptCount,
          3,
        );
      },
    );
    await t.test(
      'unpublished course or later disabled LMS access removes Continue Learning without losing purchased visibility',
      async () => {
        await db.course.update({
          where: { id: p.course!.id },
          data: { published: false },
        });
        const dto = await myPrograms(db, p.user.id);
        assert.equal(dto.items[0].state, 'ATTENTION');
        assert.equal(dto.items[0].learningPath, null);
        assert.equal(dto.items.length, 1);
        await assert.rejects(
          new LearningRepository(db, p.user).course(p.course!.id),
          { code: 'NOT_FOUND' },
        );
      },
    );
  } finally {
    await f.cleanup();
  }
});
test('M5 clean schema matches Prisma; upgrade from exact M4 preserves historical financial records and adds no grants', async () => {
  const f = await isolatedDatabase(
    undefined,
    '20261119101000_marketplace_commerce',
  );
  try {
    const before = await f.db.user.create({
      data: { clerkUserId: `m5_upgrade_${randomUUID()}` },
    });
    const cli = (args: string[]) =>
      execFileSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', ...args],
        { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
      ).toString();

    const purchase = await readyPurchase(f.db, before.id),
      provider = providerFixture(),
      payments = new CommercePayments(f.db, provider.gateway);
    const order = await purchase.order(),
      session = await payments.open(order.ref, before.id),
      payment = provider.payment(String(session.data.providerOrderId));
    const evidence = await provider.gateway.inspect(
      String(session.data.providerOrderId),
    );
    assert.equal(evidence.paid, true);
    assert.equal(evidence.payments[0].status, 'CAPTURED');
    const source = await f.db.marketplaceOrder.findUniqueOrThrow({
      where: { publicRef: order.ref },
    });
    await f.db.$transaction(async (tx) => {
      await tx.marketplacePaymentAttempt.update({
        where: { orderId: source.id },
        data: { status: 'CAPTURED', providerPaymentId: payment.id },
      });
      await tx.marketplaceOrder.update({
        where: { id: source.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      await tx.marketplaceEntitlement.create({
        data: {
          userId: before.id,
          offeringId: purchase.offering.id,
          orderId: source.id,
          grantedAt: new Date(),
        },
      });
    });
    const financialBefore = {
      order: await f.db.marketplaceOrder.findMany(),
      attempt: await f.db.marketplacePaymentAttempt.findMany(),
      entitlement: await f.db.marketplaceEntitlement.findMany(),
    };
    cli(['migrate', 'deploy']);
    assert.deepEqual(
      await f.db.user.findUnique({ where: { id: before.id } }),
      before,
    );
    assert.equal(await f.db.marketplaceDelivery.count(), 0);
    assert.equal(await f.db.enrollment.count(), 0);
    assert.deepEqual(
      {
        order: await f.db.marketplaceOrder.findMany(),
        attempt: await f.db.marketplacePaymentAttempt.findMany(),
        entitlement: await f.db.marketplaceEntitlement.findMany(),
      },
      financialBefore,
    );
    await new MarketplaceDeliveryService(f.db).reconcile({
      ownerId: before.id,
    });
    assert.equal(
      (await f.db.marketplaceDelivery.findFirstOrThrow()).status,
      'NOT_REQUIRED',
    );
    assert.equal(await f.db.enrollment.count(), 0);
    assert.deepEqual(
      {
        order: await f.db.marketplaceOrder.findMany(),
        attempt: await f.db.marketplacePaymentAttempt.findMany(),
        entitlement: await f.db.marketplaceEntitlement.findMany(),
      },
      financialBefore,
    );
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
  } finally {
    await f.cleanup();
  }
});
test('M5 guard, current database isolation and private cache/API boundaries remain strict', () => {
  const rows = migrationManifest.map((m) => ({
    migration_name: m.name,
    checksum: m.checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  }));
  assert.throws(() => requireMarketplaceDeliveryBaseline(rows.slice(0, 20)));
  assert.deepEqual(requireMarketplaceDeliveryBaseline(rows), []);
  assert.throws(() => requireMarketplaceCommerceBaseline(rows.slice(0, 20)));
  assert.throws(() => requireMarketplaceDeliveryBaseline(rows.slice(0, 19)));
  const previous = process.env.TEST_DATABASE_URL;
  try {
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
    assert.throws(testDatabaseUrl);
  } finally {
    process.env.TEST_DATABASE_URL = previous;
  }
  for (const path of [
    'src/lib/marketplace/delivery/service.ts',
    'src/lib/marketplace/delivery/read.ts',
  ])
    assert.doesNotMatch(
      readFileSync(path, 'utf8'),
      /unstable_cache|use cache|marketplace-generation|\.certificate\.create|roleAssignments\.create/,
    );
  const api = readFileSync(
    'src/app/api/admin/marketplace/delivery/[[...path]]/route.ts',
    'utf8',
  );
  assert.match(api, /requireAdminActor/);
  assert.match(api, /requestBody/);
  assert.match(api, /\.strict\(\)/);
  assert.doesNotMatch(api, /Mark Active|Grant Access/);
});
