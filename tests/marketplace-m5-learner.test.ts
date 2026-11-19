import { readyPurchase } from './helpers/marketplace-m4';
import { providerFixture } from './helpers/marketplace-m4-provider';
import { CommercePayments } from '../src/lib/marketplace/commerce/payments';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isolatedDatabase } from './helpers/d4-database';
import { m5Purchase } from './helpers/marketplace-m5';
import { MarketplaceDeliveryService } from '../src/lib/marketplace/delivery/service';
import { entitledStudentWhere } from '../src/lib/lms/entitlement';
import { LearningRepository } from '../src/lib/lms/learning';
import { LmsRepository } from '../src/lib/lms/repository';
import { Academics } from '../src/lib/lms/academics';
import { requireAdminPermission } from '../src/lib/auth/admin-policy';
import { provisionUser } from '../src/lib/student/repository';
import { learnerProfile } from '../src/lib/lms/profile';
import { LmsAccessAdmin } from '../src/lib/lms/access-admin';
import { migrationManifest } from '../src/lib/production/migrations';
import { requireMarketplaceLearnerBaseline } from '../scripts/marketplace/safety';

test('M5 learner capability: persisted identity, commercial authority and preserved personas/history', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db;
  const service = new MarketplaceDeliveryService(db);
  const allowed = (id: string) =>
    db.user.findFirst({
      where: entitledStudentWhere(id),
      select: { id: true },
    });
  const account = (role: 'STUDENT' | 'ADMIN' | 'INSTRUCTOR' = 'STUDENT') =>
    db.user.create({ data: { role, clerkUserId: `learner_${randomUUID()}` } });
  const refund = async (p: Awaited<ReturnType<typeof m5Purchase>>) => {
    p.provider.payment(p.providerOrder, {
      status: 'refunded',
      amount_refunded: p.intent.quote.priceMinor,
    });
    await p.payments.reconcile(p.order.ref, p.user.id);
  };
  try {
    await t.test(
      'new ordinary account uses canonical Student issuer and becomes active without prior business entitlement',
      async () => {
        const clerkId = `ordinary_${randomUUID()}`;
        const actors = await Promise.all(
          Array.from({ length: 8 }, () => provisionUser(db, clerkId)),
        );
        assert.equal(new Set(actors.map((a) => a.id)).size, 1);
        const user = await db.user.findUniqueOrThrow({
          where: { id: actors[0].id },
        });
        assert.match(user.studentId!, /^ST-\d{4}-\d{6,}$/);
        assert.equal(user.lmsAccessOverride, null);
        assert.equal(await allowed(user.id), null);
        const p = await m5Purchase(db, { lms: true, userId: user.id });
        await service.run(p.delivery.publicRef, p.authority);
        const d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: p.delivery.id },
        });
        assert.equal(d.status, 'ACTIVE');
        assert.equal(d.lmsAccessProvenance, 'CREATED');
        assert.equal(d.learnerIdentityProvenance, 'REUSED');
        assert.ok(await allowed(user.id));
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
            .studentId,
          user.studentId,
        );
        assert.equal(
          await db.marketplaceLearnerIdentity.count({
            where: { userId: user.id },
          }),
          0,
        );
        assert.equal(
          await db.studentProfile.count({ where: { userId: user.id } }),
          0,
        );
        assert.ok(await new LearningRepository(db, user).course(p.course!.id));
      },
    );
    for (const role of ['ADMIN', 'INSTRUCTOR'] as const)
      await t.test(
        `${role}: concurrent cross-instance purchases issue one learner identity/ID without modifying privileged authority`,
        async () => {
          const user = await account(role);
          const policy =
            role === 'ADMIN'
              ? await db.adminAuthorization.create({
                  data: { userId: user.id, permissions: ['COMMERCE_VIEW'] },
                })
              : null;
          const profile = await db.studentProfile.create({
            data: {
              userId: user.id,
              institution: 'Preserved institution',
              interests: ['Existing interest'],
            },
          });
          const a = await m5Purchase(db, { lms: true, userId: user.id });
          const b = await m5Purchase(db, {
            lms: true,
            userId: user.id,
            courseId: a.course!.id,
          });
          assert.equal(await allowed(user.id), null);
          await Promise.all(
            Array.from({ length: 8 }, (_, i) =>
              new MarketplaceDeliveryService(db).run(
                (i % 2 ? a : b).delivery.publicRef,
                a.authority,
              ),
            ),
          );
          const after = await db.user.findUniqueOrThrow({
            where: { id: user.id },
          });
          assert.equal(after.role, role);
          assert.equal(after.clerkUserId, user.clerkUserId);
          assert.equal(after.lmsAccessOverride, null);
          assert.match(after.studentId!, /^ST-\d{4}-\d{6,}$/);
          assert.equal(
            await db.user.count({ where: { studentId: after.studentId } }),
            1,
          );
          assert.equal(
            await db.marketplaceLearnerIdentity.count({
              where: { userId: user.id },
            }),
            1,
          );
          assert.equal(
            await db.userRoleAssignment.count({ where: { userId: user.id } }),
            0,
          );
          assert.deepEqual(
            await db.studentProfile.findUnique({ where: { userId: user.id } }),
            profile,
          );
          assert.equal(
            await db.enrollment.count({ where: { userId: user.id } }),
            1,
          );
          const rows = await db.marketplaceDelivery.findMany({
            where: { entitlement: { userId: user.id } },
          });
          assert.ok(
            rows.every(
              (r) =>
                r.status === 'ACTIVE' && r.lmsAccessProvenance === 'CREATED',
            ),
          );
          assert.equal(
            rows.filter((r) => r.learnerIdentityProvenance === 'CREATED')
              .length,
            1,
          );
          if (policy) {
            assert.deepEqual(
              await db.adminAuthorization.findUnique({
                where: { userId: user.id },
              }),
              policy,
            );
            await requireAdminPermission(db, user.id, 'COMMERCE_VIEW');
          }
          assert.ok(await new LmsRepository(db, after).courses());
          assert.deepEqual(
            (await new Academics(db, after).attendance()).sessions,
            [],
          );
          assert.equal(
            (await learnerProfile(db, user.id))!.institution,
            'Preserved institution',
          );
          await assert.rejects(learnerProfile(db, user.id, { role: 'ADMIN' }), {
            code: 'INVALID_INPUT',
          });
          const independentEnrollment = await db.enrollment.findUniqueOrThrow({
            where: {
              userId_courseId: { userId: user.id, courseId: a.course!.id },
            },
          });
          await refund(a);
          assert.ok(await allowed(user.id));
          assert.ok(
            await new LearningRepository(db, after).course(a.course!.id),
          );
          await refund(b);
          assert.equal(await allowed(user.id), null);
          await assert.rejects(new LmsRepository(db, after).authorize(), {
            code: 'FORBIDDEN',
          });
          await assert.rejects(
            new LearningRepository(db, after).course(a.course!.id),
            { code: 'FORBIDDEN' },
          );
          await assert.rejects(learnerProfile(db, user.id), {
            code: 'FORBIDDEN',
          });
          await service.reconcile(a.authority);
          assert.deepEqual(
            await db.enrollment.findUnique({
              where: { id: independentEnrollment.id },
            }),
            independentEnrollment,
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
              .studentId,
            after.studentId,
          );
          assert.ok(
            await db.marketplaceLearnerIdentity.findUnique({
              where: { userId: user.id },
            }),
          );
          assert.deepEqual(
            await db.studentProfile.findUnique({ where: { userId: user.id } }),
            profile,
          );
          if (policy)
            await requireAdminPermission(db, user.id, 'COMMERCE_VIEW');
          await assert.rejects(
            db.user.update({
              where: { id: user.id },
              data: { studentId: 'ST-2026-99999999' },
            }),
          );
          await assert.rejects(
            db.marketplaceLearnerIdentity.delete({
              where: { userId: user.id },
            }),
          );
          // A later independent staff-authorized grant works with retained identity, without repurchase.
          await db.user.update({
            where: { id: user.id },
            data: { lmsAccessOverride: 'ENABLED' },
          });
          assert.ok(await allowed(user.id));
        },
      );
    await t.test(
      'independent access and existing profile/enrollment are reused; refund preserves all independent authority',
      async () => {
        const user = await account();
        await db.user.update({
          where: { id: user.id },
          data: { lmsAccessOverride: 'ENABLED' },
        });
        const p = await m5Purchase(db, { lms: true, userId: user.id });
        const enrollment = await db.enrollment.create({
          data: {
            userId: user.id,
            courseId: p.course!.id,
            status: 'IN_PROGRESS',
          },
        });
        await service.run(p.delivery.publicRef, p.authority);
        const d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: p.delivery.id },
        });
        assert.equal(d.lmsAccessProvenance, 'REUSED');
        assert.equal(d.provenance, 'REUSED');
        await refund(p);
        await service.reconcile(p.authority);
        assert.ok(await allowed(user.id));
        assert.ok(await new LearningRepository(db, user).course(p.course!.id));
        assert.deepEqual(
          await db.enrollment.findUnique({ where: { id: enrollment.id } }),
          enrollment,
        );
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
            .lmsAccessOverride,
          'ENABLED',
        );
      },
    );
    await t.test(
      'active Batch authority is reused; valid purchase sustains access when inherited authority ends',
      async () => {
        const user = await account();
        const batch = await db.batch.create({
          data: {
            code: `L-${randomUUID().slice(0, 8).toUpperCase()}`,
            name: 'Independent batch',
            status: 'ACTIVE',
            lmsAccessEnabled: true,
          },
        });
        const membership = await db.batchMembership.create({
          data: { batchId: batch.id, userId: user.id },
        });
        const p = await m5Purchase(db, { lms: true, userId: user.id });
        await service.run(p.delivery.publicRef, p.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: p.delivery.id },
            })
          ).lmsAccessProvenance,
          'REUSED',
        );
        await db.batchMembership.update({
          where: { id: membership.id },
          data: { status: 'INACTIVE', leftAt: new Date() },
        });
        assert.ok(await allowed(user.id));
        await refund(p);
        assert.equal(await allowed(user.id), null);
      },
    );
    await t.test(
      'multiple different Courses sustain account access until final refund; no identity/history destruction',
      async () => {
        const user = await account();
        const a = await m5Purchase(db, { lms: true, userId: user.id });
        const b = await m5Purchase(db, { lms: true, userId: user.id });
        await Promise.all([
          service.run(a.delivery.publicRef, a.authority),
          service.run(b.delivery.publicRef, b.authority),
        ]);
        await refund(a);
        assert.ok(await allowed(user.id));
        await assert.rejects(
          new LearningRepository(db, user).course(a.course!.id),
          { code: 'NOT_FOUND' },
        );
        assert.ok(await new LearningRepository(db, user).course(b.course!.id));
        await refund(b);
        assert.equal(await allowed(user.id), null);
        assert.equal(
          await db.enrollment.count({ where: { userId: user.id } }),
          2,
        );
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
            .studentId,
          user.studentId,
        );
      },
    );
    await t.test(
      'explicit Admin DISABLED denies both inherited and Marketplace grants and blocks new provisioning',
      async () => {
        const user = await account();
        const p = await m5Purchase(db, { lms: true, userId: user.id });
        await db.user.update({
          where: { id: user.id },
          data: { lmsAccessOverride: 'DISABLED' },
        });
        await service.run(p.delivery.publicRef, p.authority);
        let d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: p.delivery.id },
        });
        assert.equal(d.status, 'REVIEW');
        assert.equal(d.lastErrorCode, 'LMS_ACCESS_DISABLED');
        assert.equal(d.lmsAccessProvenance, 'NONE');
        assert.equal(await allowed(user.id), null);
        const operator = await db.user.create({
          data: {
            role: 'ADMIN',
            clerkUserId: `operator_${randomUUID()}`,
            adminAuthorization: {
              create: {
                permissions: [
                  'STUDENTS_MANAGE',
                  'COMMERCE_VIEW',
                  'DELIVERY_MANAGE',
                ],
              },
            },
          },
        });
        await new LmsAccessAdmin(db, operator.id).change({
          kind: 'STUDENT_OVERRIDE',
          userId: user.id,
          value: null,
        });
        await service.run(
          p.delivery.publicRef,
          { adminActorId: operator.id },
          true,
        );
        d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: d.id },
        });
        assert.equal(d.status, 'ACTIVE');
        await new LmsAccessAdmin(db, operator.id).change({
          kind: 'STUDENT_OVERRIDE',
          userId: user.id,
          value: 'DISABLED',
        });
        assert.equal(await allowed(user.id), null);
        await assert.rejects(
          new LearningRepository(db, user).course(p.course!.id),
          { code: 'FORBIDDEN' },
        );
        assert.equal(
          (
            await db.marketplaceEntitlement.findUniqueOrThrow({
              where: { id: p.entitlement.id },
            })
          ).status,
          'ACTIVE',
        );
      },
    );
    await t.test(
      'PENDING/PROVISIONING and identity alone never grant public LMS access; no circular provisioning requirement',
      async () => {
        const user = await account('INSTRUCTOR');
        const p = await m5Purchase(db, { lms: true, userId: user.id });
        assert.equal(await allowed(user.id), null);
        await new MarketplaceDeliveryService(
          db,
          () => new Date(),
          async () => {
            assert.equal(
              (
                await db.marketplaceDelivery.findUniqueOrThrow({
                  where: { id: p.delivery.id },
                })
              ).status,
              'PROVISIONING',
            );
            assert.equal(await allowed(user.id), null);
            await assert.rejects(new LmsRepository(db, user).authorize(), {
              code: 'FORBIDDEN',
            });
          },
        ).run(p.delivery.publicRef, p.authority);
        assert.ok(await allowed(user.id));
        await refund(p);
        assert.ok(
          await db.marketplaceLearnerIdentity.findUnique({
            where: { userId: user.id },
          }),
        );
        assert.equal(await allowed(user.id), null);
        const q = await m5Purchase(db, { lms: false, userId: user.id });
        await service.run(q.delivery.publicRef, q.authority);
        assert.equal(await allowed(user.id), null);
      },
    );
    await t.test(
      'learner/audit failure rolls back identity/grant/enrollment but keeps paid ownership; canonical retry succeeds',
      async () => {
        const user = await account('INSTRUCTOR');
        const p = await m5Purchase(db, { lms: true, userId: user.id });
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${f.schema}".fail_learner_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind::text='MarketplaceLmsAccessGranted' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER fail_learner_audit BEFORE INSERT ON "${f.schema}"."MarketplaceCommerceEvent" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".fail_learner_audit()`,
        );
        try {
          await service.run(p.delivery.publicRef, p.authority);
        } finally {
          await db.$executeRawUnsafe(
            `DROP TRIGGER fail_learner_audit ON "${f.schema}"."MarketplaceCommerceEvent"`,
          );
        }
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: p.delivery.id },
            })
          ).status,
          'FAILED',
        );
        assert.equal(
          await db.marketplaceLearnerIdentity.count({
            where: { userId: user.id },
          }),
          0,
        );
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
            .studentId,
          null,
        );
        assert.equal(
          await db.enrollment.count({ where: { userId: user.id } }),
          0,
        );
        assert.equal(
          (await p.payments.view(p.order.ref, user.id)).status,
          'PAID',
        );
        assert.equal(
          (await p.payments.view(p.order.ref, user.id)).entitlementStatus,
          'ACTIVE',
        );
        await new MarketplaceDeliveryService(
          db,
          () => new Date(Date.now() + 6 * 60000),
        ).run(p.delivery.publicRef, p.authority);
        assert.ok(await allowed(user.id));
        assert.equal(
          await db.marketplaceCommerceEvent.count({
            where: {
              orderId: p.entitlement.orderId,
              kind: 'MarketplaceLearnerProvisioned',
            },
          }),
          1,
        );
        await assert.rejects(
          db.marketplaceDelivery.update({
            where: { id: p.delivery.id },
            data: { lmsAccessProvenance: 'REUSED' },
          }),
        );
      },
    );
    await t.test(
      'non-LMS, wrong owner and invalid Course cannot provision learner identity or commercial account access',
      async () => {
        const user = await account('INSTRUCTOR');
        const p = await m5Purchase(db, { userId: user.id });
        await service.run(p.delivery.publicRef, p.authority);
        const q = await m5Purchase(db, { lms: true, userId: user.id });
        await assert.rejects(
          service.run(q.delivery.publicRef, { ownerId: 'other' }),
          { code: 'NOT_FOUND' },
        );
        await db.course.update({
          where: { id: q.course!.id },
          data: { published: false },
        });
        await service.run(q.delivery.publicRef, q.authority);
        assert.equal(await allowed(user.id), null);
        assert.equal(
          await db.marketplaceLearnerIdentity.count({
            where: { userId: user.id },
          }),
          0,
        );
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
            .studentId,
          null,
        );
        await assert.rejects(
          db.marketplaceLearnerIdentity.create({
            data: { userId: user.id, createdByDeliveryId: q.delivery.id },
          }),
        );
        await assert.rejects(new LmsRepository(db, user).authorize(), {
          code: 'FORBIDDEN',
        });
        await assert.rejects(
          new LearningRepository(db, user).course(q.course!.id),
          { code: 'FORBIDDEN' },
        );
      },
    );
  } finally {
    await f.cleanup();
  }
});

test('single learner migration upgrades populated M5 without rewriting identity/learning/financial history', async () => {
  const f = await isolatedDatabase(
    undefined,
    '20261119112000_delivery_provenance_constraint',
  );
  try {
    const user = await f.db.user.create({
      data: { clerkUserId: `upgrade_${randomUUID()}` },
    });
    const staff = await f.db.user.create({
      data: { clerkUserId: `upgrade_staff_${randomUUID()}`, role: 'ADMIN' },
    });
    const profile = await f.db.studentProfile.create({
      data: { userId: user.id, institution: 'Existing' },
    });
    const purchase = await readyPurchase(f.db, user.id),
      provider = providerFixture(),
      payments = new CommercePayments(f.db, provider.gateway);
    const order = await purchase.order(),
      checkout = await payments.open(order.ref, user.id);
    const payment = provider.payment(String(checkout.data.providerOrderId));
    assert.equal(
      (await provider.gateway.inspect(String(checkout.data.providerOrderId)))
        .paid,
      true,
    );
    const source = await f.db.marketplaceOrder.findUniqueOrThrow({
      where: { publicRef: order.ref },
    });
    const course = await f.db.course.create({
      data: {
        title: 'Preserved course',
        description: 'Existing course',
        thumbnailPath: '/images/campus.webp',
        thumbnailAlt: 'Campus',
        publicPath: '/#programs',
        published: true,
      },
    });
    const enrollment = await f.db.enrollment.create({
      data: { userId: user.id, courseId: course.id, status: 'IN_PROGRESS' },
    });
    const deliveryId = randomUUID(),
      publicRef = randomBytes(32).toString('base64url');
    await f.db.$transaction(async (tx) => {
      await tx.marketplacePaymentAttempt.update({
        where: { orderId: source.id },
        data: { status: 'CAPTURED', providerPaymentId: payment.id },
      });
      await tx.marketplaceOrder.update({
        where: { id: source.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      const entitlement = await tx.marketplaceEntitlement.create({
        data: {
          userId: user.id,
          offeringId: purchase.offering.id,
          orderId: source.id,
          grantedAt: new Date(),
        },
      });
      await tx.$executeRawUnsafe(
        `INSERT INTO "${f.schema}"."MarketplaceDelivery" (id,"publicRef","entitlementId",type,status,"courseId","enrollmentId","createdEnrollmentId",provenance,"provisionedAt",revision,"updatedAt") VALUES ($1,$2,$3,'LMS','ACTIVE',$4,$5,$5,'CREATED',CURRENT_TIMESTAMP,$6::uuid,CURRENT_TIMESTAMP)`,
        deliveryId,
        publicRef,
        entitlement.id,
        course.id,
        enrollment.id,
        randomUUID(),
      );
    });
    const before = {
      user,
      staff,
      profile,
      enrollment,
      order: await f.db.marketplaceOrder.findMany(),
      entitlement: await f.db.marketplaceEntitlement.findMany(),
      events: await f.db.marketplaceCommerceEvent.findMany(),
    };
    const cli = (args: string[]) =>
      execFileSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', ...args],
        { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
      ).toString();
    cli(['migrate', 'deploy']);
    assert.deepEqual(
      {
        user: await f.db.user.findUniqueOrThrow({ where: { id: user.id } }),
        staff: await f.db.user.findUniqueOrThrow({ where: { id: staff.id } }),
        profile: await f.db.studentProfile.findUniqueOrThrow({
          where: { userId: user.id },
        }),
        enrollment: await f.db.enrollment.findUniqueOrThrow({
          where: { id: enrollment.id },
        }),
        order: await f.db.marketplaceOrder.findMany(),
        entitlement: await f.db.marketplaceEntitlement.findMany(),
        events: await f.db.marketplaceCommerceEvent.findMany(),
      },
      before,
    );
    assert.equal(await f.db.marketplaceLearnerIdentity.count(), 0);
    const d = await f.db.marketplaceDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    assert.equal(d.lmsAccessProvenance, 'NONE');
    assert.equal(d.status, 'ACTIVE');
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

test('learner local migration guard permits only the new forward migration and pinned checksums', () => {
  const rows = migrationManifest.map((m) => ({
    migration_name: m.name,
    checksum: m.checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  }));
  assert.deepEqual(requireMarketplaceLearnerBaseline(rows.slice(0, 23)), [
    '20261119113000_marketplace_learner_capability',
  ]);
  assert.deepEqual(requireMarketplaceLearnerBaseline(rows), []);
  assert.throws(() => requireMarketplaceLearnerBaseline(rows.slice(0, 22)));
  for (const migration of migrationManifest)
    assert.equal(
      createHash('sha256')
        .update(
          readFileSync(`prisma/migrations/${migration.name}/migration.sql`),
        )
        .digest('hex'),
      migration.checksum,
    );
});
