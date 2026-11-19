import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import { offeringInput } from './helpers/marketplace-m2';
import { EnrollmentService } from '../src/lib/marketplace/enrollment/service';
import type { EnrollmentView } from '../src/lib/marketplace/enrollment/types';
const proof = () => randomBytes(32).toString('hex');
const about = {
  fullName: 'Synthetic Student',
  phone: '+91 98765 43210',
  city: 'Pune',
  region: 'Maharashtra',
  country: 'India',
};
const education = {
  educationLevel: 'UNDERGRADUATE',
  currentStatus: 'COLLEGE_STUDENT',
  institution: 'Synthetic Institute',
};
const goal = {
  goal: 'Build practical skills through guided projects.',
  source: 'Synthetic fixture',
};
test('M3 clean PostgreSQL migration, private intent lifecycle, ownership and concurrency', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db;
  let clock = new Date();
  const service = new EnrollmentService(db, () => clock);
  try {
    const a = await db.user.create({
        data: { clerkUserId: `m3_a_${randomUUID()}` },
      }),
      b = await db.user.create({
        data: { clerkUserId: `m3_b_${randomUUID()}` },
      });
    async function offering(slug: string, extra: object = {}) {
      const { courseRef, ...data } = offeringInput(slug);
      void courseRef;
      return db.marketplaceOffering.create({
        data: {
          ...data,
          publicationStatus: 'PUBLISHED',
          publishedAt: new Date(),
          ...extra,
        },
      });
    }
    await offering('m3-main');
    let view: EnrollmentView;
    const browser = proof();
    await t.test(
      'signed-out OPEN creates opaque 24-hour server quote without owner',
      async () => {
        view = await service.start(null, browser, { slug: 'm3-main' });
        assert.equal(view.state, 'ACCOUNT_REQUIRED');
        assert.equal(view.needsClaim, true);
        assert.match(view.ref, /^[A-Za-z0-9_-]{43}$/);
        assert.equal(Date.parse(view.expiresAt) - clock.getTime(), 86400000);
        assert.equal(view.quote.priceMinor, 1500000);
        assert.equal(view.quote.currency, 'INR');
      },
    );
    await t.test(
      'duplicate anonymous clicks reuse one compatible active quote',
      async () => {
        const rows = await Promise.all(
          Array.from({ length: 6 }, () =>
            service.start(null, browser, { slug: 'm3-main' }),
          ),
        );
        assert.ok(rows.every((r) => r.ref === view.ref));
        assert.equal(await db.marketplaceEnrollmentIntent.count(), 1);
      },
    );
    await t.test(
      'guessed refs and wrong browser proofs fail uniformly',
      async () => {
        for (const [ref, p] of [
          [randomBytes(32).toString('base64url'), browser],
          [view.ref, proof()],
          [view.ref, null],
          ['invalid', browser],
        ])
          await assert.rejects(service.view(ref!, a.id, p), {
            code: 'NOT_FOUND',
          });
      },
    );
    await t.test(
      'claim requires the creating browser proof even with authenticated account',
      async () => {
        await assert.rejects(
          service.claim(view.ref, b.id, proof(), { revision: view.revision }),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(
          service.claim(view.ref, b.id, null, { revision: view.revision }),
          { code: 'NOT_FOUND' },
        );
      },
    );
    await t.test(
      'claim binds user and consumes anonymous proof; same-owner replay is idempotent',
      async () => {
        const old = view;
        view = await service.claim(view.ref, a.id, browser, {
          revision: view.revision,
        });
        assert.equal(view.state, 'ONBOARDING_REQUIRED');
        assert.equal(view.needsClaim, false);
        assert.notEqual(view.revision, old.revision);
        assert.equal(
          (
            await service.claim(view.ref, a.id, browser, {
              revision: old.revision,
            })
          ).ref,
          view.ref,
        );
        assert.equal(
          (
            await db.marketplaceEnrollmentIntent.findUniqueOrThrow({
              where: { publicRef: view.ref },
            })
          ).browserHash,
          null,
        );
      },
    );
    await t.test(
      'bound intent cannot be claimed or read by another user even with original proof',
      async () => {
        await assert.rejects(
          service.claim(view.ref, b.id, browser, { revision: view.revision }),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(service.view(view.ref, b.id, browser), {
          code: 'NOT_FOUND',
        });
        await assert.rejects(service.view(view.ref, null, browser), {
          code: 'NOT_FOUND',
        });
      },
    );
    await t.test('incomplete checkout and step skipping fail', async () => {
      await assert.rejects(service.checkout(view.ref, a.id), {
        code: 'CONFLICT',
      });
      await assert.rejects(
        service.saveStep(view.ref, a.id, {
          step: 3,
          revision: view.revision,
          ...goal,
        }),
        { code: 'CONFLICT' },
      );
    });
    await t.test(
      'about-you progress normalizes phone and persists across new service instance',
      async () => {
        view = await service.saveStep(view.ref, a.id, {
          step: 1,
          revision: view.revision,
          ...about,
        });
        assert.equal(view.completedStep, 1);
        assert.equal(view.values.phone, '+919876543210');
        assert.deepEqual(
          await new EnrollmentService(db).view(view.ref, a.id, null),
          view,
        );
      },
    );
    await t.test(
      'cross-user onboarding edit and checkout are denied',
      async () => {
        await assert.rejects(
          service.saveStep(view.ref, b.id, {
            step: 1,
            revision: view.revision,
            ...about,
          }),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(service.checkout(view.ref, b.id), {
          code: 'NOT_FOUND',
        });
      },
    );
    await t.test('stale revisions reject without lost updates', async () => {
      await assert.rejects(
        service.saveStep(view.ref, a.id, {
          step: 1,
          revision: randomUUID(),
          ...about,
        }),
        { code: 'CONFLICT' },
      );
    });
    await t.test(
      'concurrent edits commit exactly one new revision and audit event',
      async () => {
        const before = await db.marketplaceEnrollmentEvent.count();
        const result = await Promise.allSettled([
          service.saveStep(view.ref, a.id, {
            step: 2,
            revision: view.revision,
            ...education,
          }),
          service.saveStep(view.ref, a.id, {
            step: 2,
            revision: view.revision,
            ...education,
            institution: 'Other synthetic institution',
          }),
        ]);
        assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal(await db.marketplaceEnrollmentEvent.count(), before + 1);
        view = await service.view(view.ref, a.id, null);
      },
    );
    await t.test(
      'goal progress saves; review requires explicit true consent',
      async () => {
        view = await service.saveStep(view.ref, a.id, {
          step: 3,
          revision: view.revision,
          ...goal,
        });
        assert.equal(view.completedStep, 3);
        await assert.rejects(
          service.saveStep(view.ref, a.id, {
            step: 4,
            revision: view.revision,
            consent: false,
          }),
          { code: 'INVALID_INPUT' },
        );
      },
    );
    await t.test(
      'completion atomically creates READY_FOR_CHECKOUT with versioned acknowledgement',
      async () => {
        view = await service.saveStep(view.ref, a.id, {
          step: 4,
          revision: view.revision,
          consent: true,
        });
        assert.equal(view.state, 'READY_FOR_CHECKOUT');
        assert.ok(view.completedAt);
        assert.equal((await service.checkout(view.ref, a.id)).ref, view.ref);
      },
    );
    await t.test(
      'price/currency/cohort edits preserve existing quote and fresh starts receive current quote',
      async () => {
        await db.marketplaceOffering.update({
          where: { slug: 'm3-main' },
          data: {
            priceMinor: 2000000,
            currency: 'USD',
            cohortStartsAt: new Date('2027-01-01'),
          },
        });
        assert.equal(
          (await service.checkout(view.ref, a.id)).quote.priceMinor,
          1500000,
        );
        assert.equal(
          (await service.checkout(view.ref, a.id)).quote.currency,
          'INR',
        );
        const fresh = await service.start(a.id, proof(), { slug: 'm3-main' });
        assert.notEqual(fresh.ref, view.ref);
        assert.equal(fresh.quote.priceMinor, 2000000);
        assert.equal(fresh.quote.currency, 'USD');
        assert.equal(fresh.quote.cohortStartsAt, '2027-01-01T00:00:00.000Z');
      },
    );
    for (const status of ['DRAFT', 'UNPUBLISHED', 'ARCHIVED'] as const)
      await t.test(
        `${status} offerings cannot create intents and block existing checkout`,
        async () => {
          await offering(`m3-${status.toLowerCase().replaceAll('_', '-')}`, {
            publicationStatus: status,
          });
          await assert.rejects(
            service.start(a.id, proof(), {
              slug: `m3-${status.toLowerCase().replaceAll('_', '-')}`,
            }),
            { code: 'NOT_FOUND' },
          );
          await db.marketplaceOffering.update({
            where: { slug: 'm3-main' },
            data: { publicationStatus: status },
          });
          await assert.rejects(service.checkout(view.ref, a.id), {
            code: 'CONFLICT',
          });
          assert.equal(
            (await service.view(view.ref, a.id, null)).access,
            'unavailable',
          );
          await db.marketplaceOffering.update({
            where: { slug: 'm3-main' },
            data: { publicationStatus: 'PUBLISHED' },
          });
        },
      );
    for (const status of ['CLOSED', 'COMING_SOON', 'WAITLIST'] as const)
      await t.test(
        `${status} never starts enrollment or permits checkout`,
        async () => {
          await offering(`m3-${status.toLowerCase().replaceAll('_', '-')}`, {
            availabilityStatus: status,
          });
          await assert.rejects(
            service.start(a.id, proof(), {
              slug: `m3-${status.toLowerCase().replaceAll('_', '-')}`,
            }),
            { code: 'CONFLICT' },
          );
          await db.marketplaceOffering.update({
            where: { slug: 'm3-main' },
            data: { availabilityStatus: status },
          });
          await assert.rejects(service.checkout(view.ref, a.id), {
            code: 'CONFLICT',
          });
          await db.marketplaceOffering.update({
            where: { slug: 'm3-main' },
            data: { availabilityStatus: 'OPEN' },
          });
        },
      );
    await t.test(
      'null price cannot start; withdrawal of price blocks an existing checkout',
      async () => {
        await offering('m3-unannounced', { priceMinor: null });
        await assert.rejects(
          service.start(a.id, proof(), { slug: 'm3-unannounced' }),
          { code: 'CONFLICT' },
        );
        await db.marketplaceOffering.update({
          where: { slug: 'm3-main' },
          data: { priceMinor: null },
        });
        await assert.rejects(service.checkout(view.ref, a.id), {
          code: 'CONFLICT',
        });
        await db.marketplaceOffering.update({
          where: { slug: 'm3-main' },
          data: { priceMinor: 2000000 },
        });
      },
    );
    await t.test(
      'zero is a valid program price without granting learning access',
      async () => {
        await offering('m3-zero', { priceMinor: 0 });
        assert.equal(
          (await service.start(a.id, proof(), { slug: 'm3-zero' })).quote
            .priceMinor,
          0,
        );
      },
    );
    await t.test(
      'signed-in repeated concurrent starts reuse compatible owned intent directly',
      async () => {
        const rows = await Promise.all(
          Array.from({ length: 6 }, () =>
            service.start(a.id, proof(), { slug: 'm3-zero' }),
          ),
        );
        assert.ok(rows.every((r) => r.ref === rows[0].ref));
        assert.equal(rows[0].needsClaim, false);
      },
    );
    await t.test(
      'invalid or missing offering fails without leaking private publication state',
      async () => {
        await assert.rejects(
          service.start(a.id, proof(), { slug: 'does-not-exist' }),
          { code: 'NOT_FOUND' },
        );
        await assert.rejects(
          service.start(a.id, proof(), { slug: '../invalid' }),
          { code: 'INVALID_INPUT' },
        );
      },
    );
    await t.test(
      'editing a completed submission invalidates ready state and requires reconfirmation',
      async () => {
        view = await service.saveStep(view.ref, a.id, {
          step: 1,
          revision: view.revision,
          ...about,
          city: 'Mumbai',
        });
        assert.equal(view.completedAt, null);
        assert.equal(view.state, 'ONBOARDING_REQUIRED');
        await assert.rejects(service.checkout(view.ref, a.id), {
          code: 'CONFLICT',
        });
        view = await service.saveStep(view.ref, a.id, {
          step: 4,
          revision: view.revision,
          consent: true,
        });
      },
    );
    await t.test(
      'cancellation is audited, cannot checkout, and permits a fresh compatible intent',
      async () => {
        const zero = await service.start(a.id, proof(), { slug: 'm3-zero' });
        const cancelled = await service.cancel(zero.ref, a.id, {
          revision: zero.revision,
        });
        assert.equal(cancelled.access, 'cancelled');
        await assert.rejects(service.checkout(zero.ref, a.id), {
          code: 'CONFLICT',
        });
        assert.notEqual(
          (await service.start(a.id, proof(), { slug: 'm3-zero' })).ref,
          zero.ref,
        );
      },
    );
    await t.test(
      'expiry evaluated on read preserves history and blocks writes/checkout/claim',
      async () => {
        const anon = await service.start(null, browser, { slug: 'm3-zero' });
        clock = new Date(clock.getTime() + 86400001);
        assert.equal(
          (await service.view(view.ref, a.id, null)).access,
          'expired',
        );
        await assert.rejects(service.checkout(view.ref, a.id), {
          code: 'CONFLICT',
        });
        await assert.rejects(
          service.saveStep(view.ref, a.id, {
            step: 1,
            revision: view.revision,
            ...about,
          }),
          { code: 'CONFLICT' },
        );
        await assert.rejects(
          service.claim(anon.ref, a.id, browser, { revision: anon.revision }),
          { code: 'CONFLICT' },
        );
        assert.notEqual(
          (await service.start(a.id, proof(), { slug: 'm3-main' })).ref,
          view.ref,
        );
      },
    );
    await t.test(
      'no LMS enrollment, progress, purchase or payment state created',
      async () => {
        assert.equal(await db.enrollment.count(), 0);
        assert.equal(await db.lessonState.count(), 0);
        const models = Object.keys(db).filter((k) => !k.startsWith('_'));
        assert.ok(
          !models.some((k) =>
            /^(order|payment|entitlement|paymentAttempt)$/.test(k),
          ),
        );
      },
    );
    await t.test(
      'audit is PII-minimal append-only and quote/owner immutable at database boundary',
      async () => {
        const events = await db.marketplaceEnrollmentEvent.findMany();
        const audit = JSON.stringify(events);
        assert.ok(
          !audit.includes(about.fullName) &&
            !audit.includes('+919876543210') &&
            !audit.includes(goal.goal) &&
            !audit.includes(education.institution),
        );
        assert.ok(events.some((e) => e.kind === 'EnrollmentReadyForCheckout'));
        const row = await db.marketplaceEnrollmentIntent.findUniqueOrThrow({
          where: { publicRef: view.ref },
        });
        for (const data of [
          { priceMinor: 1 },
          { currency: 'EUR' },
          { offeringId: 'other' },
          { userId: b.id },
          { expiresAt: new Date() },
        ])
          await assert.rejects(
            db.marketplaceEnrollmentIntent.update({
              where: { id: row.id },
              data,
            }),
          );
        await assert.rejects(
          db.marketplaceEnrollmentEvent.update({
            where: { id: events[0].id },
            data: { changedFields: ['phone'] },
          }),
        );
        await assert.rejects(
          db.marketplaceEnrollmentEvent.delete({ where: { id: events[0].id } }),
        );
      },
    );
    await t.test(
      'database rejects unowned onboarding and readiness without completed submission',
      async () => {
        clock = new Date();
        const anonymous = await service.start(null, proof(), {
          slug: 'm3-zero',
        });
        const row = await db.marketplaceEnrollmentIntent.findUniqueOrThrow({
          where: { publicRef: anonymous.ref },
        });
        await assert.rejects(
          db.marketplaceEnrollmentOnboarding.create({
            data: { intentId: row.id },
          }),
        );
        const owned = await service.start(b.id, proof(), { slug: 'm3-zero' });
        await assert.rejects(
          db.marketplaceEnrollmentIntent.update({
            where: { publicRef: owned.ref },
            data: { state: 'READY_FOR_CHECKOUT' },
          }),
        );
      },
    );
    await t.test(
      'audit failure rolls back the entire intent mutation',
      async () => {
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${f.schema}".fail_m3_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test atomic rollback'; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER fail_m3_audit BEFORE INSERT ON "${f.schema}"."MarketplaceEnrollmentEvent" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".fail_m3_audit()`,
        );
        const before = await db.marketplaceEnrollmentIntent.count();
        await assert.rejects(service.start(b.id, proof(), { slug: 'm3-main' }));
        assert.equal(await db.marketplaceEnrollmentIntent.count(), before);
        await db.$executeRawUnsafe(
          `DROP TRIGGER fail_m3_audit ON "${f.schema}"."MarketplaceEnrollmentEvent"`,
        );
      },
    );
  } finally {
    await f.cleanup();
  }
});

test('M3 upgrades an existing M2 database without backfill, data loss or schema drift', async () => {
  const f = await isolatedDatabase(
    undefined,
    '20261118120000_marketplace_editorial_versions',
  );
  try {
    const owner = await f.db.user.create({
      data: { clerkUserId: `m3_upgrade_${randomUUID()}` },
    });
    const { courseRef, ...data } = offeringInput('m3-upgrade-existing');
    void courseRef;
    const offering = await f.db.marketplaceOffering.create({
      data: {
        ...data,
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    const cli = (args: string[]) =>
      execFileSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', ...args],
        { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
      ).toString();
    cli(['migrate', 'deploy']);
    assert.deepEqual(
      await f.db.user.findUnique({ where: { id: owner.id } }),
      owner,
    );
    assert.deepEqual(
      await f.db.marketplaceOffering.findUnique({ where: { id: offering.id } }),
      offering,
    );
    assert.equal(await f.db.marketplaceEnrollmentIntent.count(), 0);
    assert.equal(await f.db.marketplaceEnrollmentOnboarding.count(), 0);
    assert.equal(await f.db.marketplaceEnrollmentEvent.count(), 0);
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
    assert.equal(
      (
        await new EnrollmentService(f.db).start(owner.id, proof(), {
          slug: offering.slug,
        })
      ).quote.priceMinor,
      offering.priceMinor,
    );
  } finally {
    await f.cleanup();
  }
});
