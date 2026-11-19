import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import { readyPurchase } from './helpers/marketplace-m4';
import { providerFixture } from './helpers/marketplace-m4-provider';
import { CommercePayments } from '../src/lib/marketplace/commerce/payments';
import { MarketplaceDeliveryService } from '../src/lib/marketplace/delivery/service';
import { myPrograms } from '../src/lib/marketplace/delivery/read';
import { LearningRepository } from '../src/lib/lms/learning';
import { LmsAccessAdmin } from '../src/lib/lms/access-admin';
import { StudentRepository } from '../src/lib/student/repository';
import { LmsRepository } from '../src/lib/lms/repository';
import { completionProjection } from '../src/lib/lms/completion';

test('M5 isolated PostgreSQL delivery, financial independence, provenance and access', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db,
    provider = providerFixture(),
    payments = new CommercePayments(db, provider.gateway),
    service = new MarketplaceDeliveryService(db);
  try {
    async function purchase(
      options: {
        lms?: boolean;
        courseId?: string;
        role?: 'STUDENT' | 'ADMIN' | 'INSTRUCTOR';
        allowed?: boolean;
        userId?: string;
      } = {},
    ) {
      const user = options.userId
        ? await db.user.findUniqueOrThrow({ where: { id: options.userId } })
        : await db.user.create({
            data: {
              clerkUserId: `m5_${randomUUID()}`,
              role: options.role || 'STUDENT',
              lmsAccessOverride: options.allowed === false ? null : 'ENABLED',
            },
          });
      const p = await readyPurchase(db, user.id);
      const course = options.lms
        ? options.courseId
          ? await db.course.findUniqueOrThrow({
              where: { id: options.courseId },
            })
          : await db.course.create({
              data: {
                title: 'Delivery course',
                description: 'A real course fixture',
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
      const order = await p.order(),
        session = await payments.open(order.ref, user.id),
        providerOrder = String(session.data.providerOrderId);
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
        ...p,
        user,
        course,
        order,
        providerOrder,
        entitlement,
        delivery,
        authority: { ownerId: user.id },
      };
    }
    const base = await purchase({ lms: true });
    await t.test(
      'payment commits durable pending delivery without enrolling; repeat ensure reuses one outbox row',
      async () => {
        assert.equal(base.delivery.status, 'PENDING');
        assert.equal(await db.enrollment.count(), 0);
        const repeated = await Promise.all(
          Array.from({ length: 5 }, () =>
            service.ensure(base.entitlement.id, base.authority),
          ),
        );
        assert.ok(repeated.every((d) => d.id === base.delivery.id));
        assert.equal(await db.marketplaceDelivery.count(), 1);
      },
    );
    await t.test(
      'concurrent instances provision one Enrollment with CREATED provenance and atomic audit',
      async () => {
        await Promise.all(
          Array.from({ length: 6 }, () =>
            new MarketplaceDeliveryService(db).run(
              base.delivery.publicRef,
              base.authority,
            ),
          ),
        );
        const row = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: base.delivery.id },
        });
        assert.equal(row.status, 'ACTIVE');
        assert.equal(row.provenance, 'CREATED');
        assert.equal(row.createdEnrollmentId, row.enrollmentId);
        assert.equal(row.attemptCount, 1);
        assert.equal(
          await db.enrollment.count({
            where: { userId: base.user.id, courseId: base.course!.id },
          }),
          1,
        );
        assert.equal(
          await db.marketplaceCommerceEvent.count({
            where: {
              orderId: base.entitlement.orderId,
              kind: 'MarketplaceDeliveryProvisioned',
            },
          }),
          1,
        );
        assert.ok(
          (await new LearningRepository(db, base.user).course(base.course!.id))
            .id,
        );
        assert.equal(
          (await myPrograms(db, base.user.id)).items[0].state,
          'ACTIVE',
        );
      },
    );
    await t.test(
      'LMS-disabled paid program remains owned NOT_REQUIRED without any learning writes',
      async () => {
        const p = await purchase();
        const before = await db.enrollment.count();
        await service.run(p.delivery.publicRef, p.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: p.delivery.id },
            })
          ).status,
          'NOT_REQUIRED',
        );
        assert.equal((await myPrograms(db, p.user.id)).items[0].state, 'OWNED');
        assert.equal(await db.enrollment.count(), before);
      },
    );
    await t.test(
      'temporary provisioning failure preserves PAID/ACTIVE, records safe failure and retry succeeds once',
      async () => {
        const p = await purchase({ lms: true });
        await new MarketplaceDeliveryService(
          db,
          () => new Date(),
          async () => {
            throw Error('synthetic private failure must not be stored');
          },
        ).run(p.delivery.publicRef, p.authority);
        let d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: p.delivery.id },
        });
        assert.equal(d.status, 'FAILED');
        assert.equal(d.lastErrorCode, 'PROVISIONING_UNAVAILABLE');
        assert.equal(
          (await payments.view(p.order.ref, p.user.id)).status,
          'PAID',
        );
        assert.equal(
          (await payments.view(p.order.ref, p.user.id)).entitlementStatus,
          'ACTIVE',
        );
        assert.equal(
          (await myPrograms(db, p.user.id)).items[0].state,
          'ATTENTION',
        );
        const later = new MarketplaceDeliveryService(
          db,
          () => new Date(Date.now() + 6 * 60000),
        );
        await later.reconcile(p.authority);
        d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: d.id },
        });
        assert.equal(d.status, 'ACTIVE');
        assert.equal(d.attemptCount, 2);
        await later.run(d.publicRef, p.authority);
        assert.equal(
          await db.enrollment.count({ where: { userId: p.user.id } }),
          1,
        );
      },
    );
    await t.test(
      'unpublished or missing Course enters REVIEW and never invalidates commercial ownership',
      async () => {
        const p = await purchase({ lms: true });
        await db.course.update({
          where: { id: p.course!.id },
          data: { published: false },
        });
        await service.run(p.delivery.publicRef, p.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: p.delivery.id },
            })
          ).lastErrorCode,
          'COURSE_UNAVAILABLE',
        );
        assert.equal(
          (await payments.view(p.order.ref, p.user.id)).entitlementStatus,
          'ACTIVE',
        );
        assert.equal(
          await db.enrollment.count({ where: { userId: p.user.id } }),
          0,
        );
        await db.course.update({
          where: { id: p.course!.id },
          data: { published: true },
        });
        await service.reconcile(p.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: p.delivery.id },
            })
          ).status,
          'REVIEW',
        );
      },
    );
    await t.test(
      'pre-existing independent enrollment is reused and survives a verified refund',
      async () => {
        const p = await purchase({ lms: true });
        const enrollment = await db.enrollment.create({
          data: {
            userId: p.user.id,
            courseId: p.course!.id,
            status: 'IN_PROGRESS',
          },
        });
        await service.run(p.delivery.publicRef, p.authority);
        let d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: p.delivery.id },
        });
        assert.equal(d.provenance, 'REUSED');
        assert.equal(d.createdEnrollmentId, null);
        assert.equal(d.enrollmentId, enrollment.id);
        provider.payment(p.providerOrder, {
          status: 'refunded',
          amount_refunded: p.intent.quote.priceMinor,
        });
        await payments.reconcile(p.order.ref, p.user.id);
        await service.reconcile(p.authority);
        d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: d.id },
        });
        assert.equal(d.status, 'REVOKED');
        assert.deepEqual(
          await db.enrollment.findUnique({ where: { id: enrollment.id } }),
          enrollment,
        );
        assert.ok(
          await new LearningRepository(db, p.user).course(p.course!.id),
        );
      },
    );
    await t.test(
      'Marketplace-created access fails immediately on refund before worker; all learning history remains',
      async () => {
        const section = await db.section.create({
          data: {
            courseId: base.course!.id,
            title: 'Lesson section',
            position: 1,
            published: true,
          },
        });
        const item = await db.learningItem.create({
          data: {
            sectionId: section.id,
            title: 'Real lesson',
            type: 'LESSON',
            position: 1,
            published: true,
          },
        });
        const lesson = await db.lesson.create({
          data: {
            itemId: item.id,
            format: 'TEXT',
            structuredContent: {
              version: 1,
              blocks: [{ type: 'paragraph', text: 'Preserved lesson content' }],
            },
          },
        });
        void lesson;
        const progressTime = new Date();
        const progress = await db.lessonState.create({
          data: {
            userId: base.user.id,
            itemId: item.id,
            firstAccessedAt: progressTime,
            lastAccessedAt: progressTime,
            completedAt: progressTime,
          },
        });
        const before = await db.enrollment.findUniqueOrThrow({
          where: {
            userId_courseId: {
              userId: base.user.id,
              courseId: base.course!.id,
            },
          },
        });
        provider.payment(base.providerOrder, {
          status: 'refunded',
          amount_refunded: base.intent.quote.priceMinor,
        });
        await payments.reconcile(base.order.ref, base.user.id);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: base.delivery.id },
            })
          ).status,
          'REVOKE_PENDING',
        );
        await assert.rejects(
          new LearningRepository(db, base.user).course(base.course!.id),
          { code: 'NOT_FOUND' },
        );
        assert.deepEqual(await new LmsRepository(db, base.user).courses(), []);
        assert.deepEqual(
          (await new StudentRepository(db, base.user).courses()).enrollments,
          [],
        );
        assert.equal(
          await completionProjection(db, base.user.id, base.course!.id),
          null,
        );
        await service.reconcile(base.authority);
        await service.reconcile(base.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: base.delivery.id },
            })
          ).status,
          'REVOKED',
        );
        assert.deepEqual(
          await db.enrollment.findUnique({ where: { id: before.id } }),
          before,
        );
        assert.deepEqual(
          await db.lessonState.findUnique({
            where: { userId_itemId: { userId: base.user.id, itemId: item.id } },
          }),
          progress,
        );
        assert.equal(
          await db.learningItem.count({ where: { sectionId: section.id } }),
          1,
        );
        assert.equal((await myPrograms(db, base.user.id)).items.length, 0);
      },
    );
    await t.test(
      'same Course across offerings has one creator; revoking one grant preserves another active grant',
      async () => {
        const a = await purchase({ lms: true });
        const b = await purchase({
          lms: true,
          userId: a.user.id,
          courseId: a.course!.id,
        });
        await Promise.all([
          service.run(a.delivery.publicRef, a.authority),
          service.run(b.delivery.publicRef, b.authority),
        ]);
        const ds = await db.marketplaceDelivery.findMany({
          where: {
            entitlementId: { in: [a.entitlement.id, b.entitlement.id] },
          },
        });
        assert.equal(ds.filter((d) => d.provenance === 'CREATED').length, 1);
        assert.equal(ds.filter((d) => d.provenance === 'REUSED').length, 1);
        assert.equal(
          await db.enrollment.count({
            where: { userId: a.user.id, courseId: a.course!.id },
          }),
          1,
        );
        provider.payment(a.providerOrder, {
          status: 'refunded',
          amount_refunded: a.intent.quote.priceMinor,
        });
        await payments.reconcile(a.order.ref, a.user.id);
        await service.reconcile(a.authority);
        assert.ok(
          await new LearningRepository(db, a.user).course(a.course!.id),
        );
        provider.payment(b.providerOrder, {
          status: 'refunded',
          amount_refunded: b.intent.quote.priceMinor,
        });
        await payments.reconcile(b.order.ref, b.user.id);
        await assert.rejects(
          new LearningRepository(db, a.user).course(a.course!.id),
          { code: 'NOT_FOUND' },
        );
      },
    );
    for (const role of ['ADMIN', 'INSTRUCTOR'] as const)
      await t.test(
        `${role} purchaser gains learner capability without persona or authority changes`,
        async () => {
          const p = await purchase({ lms: true, role, allowed: false });
          const before = await db.user.findUniqueOrThrow({
            where: { id: p.user.id },
          });
          await service.run(p.delivery.publicRef, p.authority);
          const delivery = await db.marketplaceDelivery.findUniqueOrThrow({
            where: { id: p.delivery.id },
          });
          const after = await db.user.findUniqueOrThrow({
            where: { id: p.user.id },
          });
          assert.equal(delivery.status, 'ACTIVE');
          assert.equal(delivery.learnerIdentityProvenance, 'CREATED');
          assert.equal(delivery.lmsAccessProvenance, 'CREATED');
          assert.equal(after.role, before.role);
          assert.equal(after.clerkUserId, before.clerkUserId);
          assert.equal(after.lmsAccessOverride, before.lmsAccessOverride);
          assert.match(after.studentId!, /^ST-\d{4}-\d{6,}$/);
          assert.equal(
            await db.userRoleAssignment.count({ where: { userId: p.user.id } }),
            0,
          );
          assert.equal(
            await db.studentProfile.count({ where: { userId: p.user.id } }),
            0,
          );
          assert.equal(
            (await myPrograms(db, p.user.id)).items[0].state,
            'ACTIVE',
          );
          assert.ok(
            await new LearningRepository(db, after).course(p.course!.id),
          );
        },
      );
    await t.test(
      'ordinary paid Student receives Marketplace LMS authorization without fabricating a Batch or override',
      async () => {
        const p = await purchase({ lms: true, allowed: false });
        await service.run(p.delivery.publicRef, p.authority);
        const delivery = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: p.delivery.id },
        });
        assert.equal(delivery.status, 'ACTIVE');
        assert.equal(delivery.learnerIdentityProvenance, 'REUSED');
        assert.equal(delivery.lmsAccessProvenance, 'CREATED');
        assert.equal(
          await db.enrollment.count({ where: { userId: p.user.id } }),
          1,
        );
        assert.equal(
          await db.batchMembership.count({ where: { userId: p.user.id } }),
          0,
        );
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: p.user.id } }))
            .lmsAccessOverride,
          null,
        );
      },
    );
    await t.test(
      'attendance-dependent Course without approved Batch mapping requires review',
      async () => {
        const p = await purchase({ lms: true });
        await db.course.update({
          where: { id: p.course!.id },
          data: { requiredAttendancePercent: 75 },
        });
        await service.run(p.delivery.publicRef, p.authority);
        assert.equal(
          (
            await db.marketplaceDelivery.findUniqueOrThrow({
              where: { id: p.delivery.id },
            })
          ).lastErrorCode,
          'BATCH_REQUIRED',
        );
      },
    );
    await t.test(
      'owner mismatch/guessed reference is denied; projection is private and multiple programs paginate',
      async () => {
        const p = await purchase({ lms: true });
        await assert.rejects(
          service.run(p.delivery.publicRef, { ownerId: base.user.id }),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(
          service.ensure(p.entitlement.id, { ownerId: base.user.id }),
          { code: 'NOT_FOUND' },
        );
        const dto = await myPrograms(db, p.user.id);
        assert.equal(dto.items.length, 1);
        assert.equal(dto.items[0].state, 'PREPARING');
        assert.equal(
          (await myPrograms(db, `nonexistent_${randomUUID()}`)).items.length,
          0,
        );
        for (const field of [
          'userId',
          'entitlementId',
          'providerSessionId',
          'phone',
          'goal',
          'studentId',
        ])
          assert.ok(!JSON.stringify(dto).includes(`"${field}"`));
        await purchase({ userId: p.user.id });
        assert.equal((await myPrograms(db, p.user.id)).items.length, 2);
        await assert.rejects(myPrograms(db, p.user.id, 0), {
          code: 'INVALID_INPUT',
        });
      },
    );
    await t.test(
      'provenance and delivery binding cannot be changed or deleted at database boundary',
      async () => {
        const p = await purchase({ lms: true });
        await service.run(p.delivery.publicRef, p.authority);
        await assert.rejects(
          db.marketplaceDelivery.update({
            where: { id: p.delivery.id },
            data: { provenance: 'REUSED', createdEnrollmentId: null },
          }),
        );
        await assert.rejects(
          db.marketplaceDelivery.delete({ where: { id: p.delivery.id } }),
        );
        const d = await db.marketplaceDelivery.findUniqueOrThrow({
          where: { id: p.delivery.id },
        });
        await assert.rejects(
          db.enrollment.delete({ where: { id: d.enrollmentId! } }),
        );
        const admin = await db.user.create({
          data: {
            clerkUserId: `admin_${randomUUID()}`,
            role: 'ADMIN',
            adminAuthorization: {
              create: { permissions: ['STUDENTS_MANAGE'] },
            },
          },
        });
        await assert.rejects(
          new LmsAccessAdmin(db, admin.id).change({
            kind: 'ENROLLMENT',
            userId: p.user.id,
            courseId: p.course!.id,
            value: null,
          }),
          { code: 'CONFLICT' },
        );
      },
    );
  } finally {
    await f.cleanup();
  }
});
