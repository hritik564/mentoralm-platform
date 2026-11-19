import 'next/dist/server/node-environment-baseline';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  cpSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { isolatedDatabase } from './helpers/d4-database';
import { m6Flow } from './helpers/marketplace-m6';
import { MarketplaceDeliveryService } from '../src/lib/marketplace/delivery/service';
import { readPublishedProgram } from '../src/lib/marketplace/program-queries';
import { pageSettings } from './helpers/marketplace-m2';
import { migrationManifest } from '../src/lib/production/migrations';
import { requireMarketplaceHardeningBaseline } from '../scripts/marketplace/safety';
import { EnrollmentService } from '../src/lib/marketplace/enrollment/service';

const cli = (url: string, args: string[]) =>
  execFileSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', ...args],
    { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' },
  ).toString();

test('M6 publication races, integer admission and direct PostgreSQL integrity attacks', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db;
  try {
    for (const state of ['UNPUBLISHED', 'ARCHIVED'] as const)
      await t.test(
        `${state} after Intent prevents new provider commitment`,
        async () => {
          const p = await m6Flow(db);
          await db.marketplaceOffering.update({
            where: { id: p.offering.id },
            data: { publicationStatus: state },
          });
          await assert.rejects(p.order(), { code: 'CONFLICT' });
          assert.equal(
            await db.marketplaceOrder.count({ where: { userId: p.user.id } }),
            0,
          );
        },
      );
    await t.test(
      'CLOSED after Order blocks provider launch but committed verified capture after archive settles old quote',
      async () => {
        const p = await m6Flow(db),
          order = await p.order();
        await db.marketplaceOffering.update({
          where: { id: p.offering.id },
          data: { availabilityStatus: 'CLOSED' },
        });
        const count = p.provider.creates;
        await assert.rejects(p.payments.open(order.ref, p.user.id), {
          code: 'CONFLICT',
        });
        assert.equal(p.provider.creates, count);
        await db.marketplaceOffering.update({
          where: { id: p.offering.id },
          data: { availabilityStatus: 'OPEN' },
        });
        const session = await p.payments.open(order.ref, p.user.id);
        p.provider.payment(String(session.data.providerOrderId));
        await db.marketplaceOffering.update({
          where: { id: p.offering.id },
          data: {
            publicationStatus: 'ARCHIVED',
            priceMinor: p.intent.quote.priceMinor + 100,
          },
        });
        await p.payments.reconcile(order.ref, p.user.id);
        assert.equal(
          (await p.orders.view(order.ref, p.user.id)).status,
          'PAID',
        );
        assert.equal(
          (await p.orders.view(order.ref, p.user.id)).program.priceMinor,
          p.intent.quote.priceMinor,
        );
      },
    );
    await t.test(
      'draft edits and page publish cannot mutate accepted quote; public draft never leaks',
      async () => {
        const p = await m6Flow(db),
          order = await p.order();
        let page = await p.pages.detail(p.offering.id);
        page = await p.pages.saveSettings(p.offering.id, {
          revision: page.revision,
          ...pageSettings,
          heroHeadline: 'M6 private draft headline',
        });
        assert.equal(
          (await readPublishedProgram(db, p.offering.slug)).program?.page
            .heroHeadline,
          pageSettings.heroHeadline,
        );
        await p.pages.publishPage(p.offering.id, { revision: page.revision });
        assert.equal(
          (await readPublishedProgram(db, p.offering.slug)).program?.page
            .heroHeadline,
          'M6 private draft headline',
        );
        assert.equal(
          (await p.orders.view(order.ref, p.user.id)).program.title,
          p.intent.quote.title,
        );
      },
    );
    await t.test(
      'LMS link pins at paid Delivery creation and cannot rebind after provisioning',
      async () => {
        const p = await m6Flow(db),
          { order } = await p.pay();
        await p.payments.reconcile(order.ref, p.user.id);
        await new MarketplaceDeliveryService(db).reconcile({
          ownerId: p.user.id,
        });
        const other = await m6Flow(db);
        await db.marketplaceOffering.update({
          where: { id: p.offering.id },
          data: { courseId: other.course.id },
        });
        const d = await db.marketplaceDelivery.findFirstOrThrow({
          where: { entitlement: { userId: p.user.id } },
        });
        assert.equal(d.courseId, p.course.id);
        await assert.rejects(
          db.marketplaceDelivery.update({
            where: { id: d.id },
            data: { courseId: other.course.id },
          }),
        );
      },
    );
    for (const amount of [0, 1, 99, 100, 2147483647])
      await t.test(
        `price ${amount}: only supported nonzero INR reaches provider, no implicit free entitlement`,
        async () => {
          const p = await m6Flow(db, { price: amount }),
            order = await p.order(),
            before = p.provider.creates;
          if (amount < 100) {
            await assert.rejects(p.payments.open(order.ref, p.user.id), {
              code: 'CONFLICT',
            });
            assert.equal(p.provider.creates, before);
            assert.equal(
              await db.marketplacePaymentAttempt.count({
                where: {
                  orderId: (
                    await db.marketplaceOrder.findUniqueOrThrow({
                      where: { publicRef: order.ref },
                    })
                  ).id,
                },
              }),
              0,
            );
          } else {
            await p.payments.open(order.ref, p.user.id);
            assert.equal(p.provider.creates, before + 1);
          }
          assert.equal(
            await db.marketplaceEntitlement.count({
              where: { userId: p.user.id },
            }),
            0,
          );
        },
      );
    await t.test(
      'null/TBA price blocks continuation; non-INR never calls provider or converts stored currency',
      async () => {
        const p = await m6Flow(db);
        await db.marketplaceOffering.update({
          where: { id: p.offering.id },
          data: { priceMinor: null },
        });
        await assert.rejects(p.order(), { code: 'CONFLICT' });
        const q = await m6Flow(db, { currency: 'USD' }),
          order = await q.order(),
          before = q.provider.creates;
        await assert.rejects(q.payments.open(order.ref, q.user.id), {
          code: 'CONFLICT',
        });
        assert.equal(q.provider.creates, before);
        assert.equal(
          (await q.orders.view(order.ref, q.user.id)).program.currency,
          'USD',
        );
        assert.equal(
          await db.marketplaceEntitlement.count({
            where: { userId: q.user.id },
          }),
          0,
        );
      },
    );
    await t.test(
      'unacknowledged/stale/unapproved terms fail closed; existing Orders retain accepted version',
      async () => {
        const p = await m6Flow(db);
        await assert.rejects(
          p.orders.create(
            p.user.id,
            { ...p.input, acknowledge: false },
            p.policy,
          ),
          { code: 'INVALID_INPUT' },
        );
        await assert.rejects(p.orders.create(p.user.id, p.input, null), {
          code: 'UNAVAILABLE',
        });
        const order = await p.order(),
          before = await db.marketplaceOrder.findUniqueOrThrow({
            where: { publicRef: order.ref },
          });
        await assert.rejects(
          p.orders.create(
            p.user.id,
            { ...p.input, termsVersion: 'test-fixture-v2' },
            { ...p.policy, version: 'test-fixture-v2' },
          ),
          { code: 'CONFLICT' },
        );
        assert.deepEqual(
          await db.marketplaceOrder.findUniqueOrThrow({
            where: { id: before.id },
          }),
          before,
        );
        const next = await m6Flow(db);
        const nextOrder = await next.orders.create(
          next.user.id,
          { ...next.input, termsVersion: 'test-fixture-v2' },
          { ...next.policy, version: 'test-fixture-v2' },
        );
        assert.equal(
          (
            await db.marketplaceOrder.findUniqueOrThrow({
              where: { publicRef: nextOrder.ref },
            })
          ).termsVersion,
          'test-fixture-v2',
        );
      },
    );
    await t.test(
      'PostgreSQL rejects Entitlement without settled relationship and immutable money/terms mutations',
      async () => {
        const p = await m6Flow(db),
          order = await p.order(),
          row = await db.marketplaceOrder.findUniqueOrThrow({
            where: { publicRef: order.ref },
          });
        await assert.rejects(
          db.marketplaceEntitlement.create({
            data: {
              orderId: row.id,
              userId: p.user.id,
              offeringId: p.offering.id,
              grantedAt: new Date(),
            },
          }),
        );
        for (const data of [
          { totalMinor: 1 },
          { currency: 'USD' },
          { termsVersion: 'tampered' },
        ])
          await assert.rejects(
            db.marketplaceOrder.update({ where: { id: row.id }, data }),
          );
      },
    );
    await t.test(
      'published versions reject UPDATE DELETE TRUNCATE and cross-Offering public pointers',
      async () => {
        const a = await m6Flow(db),
          b = await m6Flow(db),
          version = await db.marketplaceOfferingPageVersion.findFirstOrThrow({
            where: { pageId: a.offering.id },
          });
        await assert.rejects(
          db.marketplaceOfferingPageVersion.update({
            where: {
              pageId_revision: {
                pageId: version.pageId,
                revision: version.revision,
              },
            },
            data: {
              snapshotJson: { schemaVersion: 1, settings: {}, sections: [] },
            },
          }),
        );
        await assert.rejects(
          db.marketplaceOfferingPageVersion.delete({
            where: {
              pageId_revision: {
                pageId: version.pageId,
                revision: version.revision,
              },
            },
          }),
        );
        await assert.rejects(
          db.$executeRawUnsafe(
            `TRUNCATE "${f.schema}"."MarketplaceOfferingPageVersion" CASCADE`,
          ),
        );
        await assert.rejects(
          db.marketplaceOfferingPage.update({
            where: { offeringId: b.offering.id },
            data: { publishedRevision: version.revision },
          }),
        );
      },
    );
    await t.test(
      'invalid immutable snapshot cannot expose mutable draft; public projections omit private/internal identifiers',
      async () => {
        const p = await m6Flow(db),
          revision = randomUUID();
        await db.marketplaceOfferingPageVersion.create({
          data: {
            pageId: p.offering.id,
            revision,
            snapshotJson: {
              schemaVersion: 1,
              settings: { heroHeadline: 123 },
              sections: [],
            },
          },
        });
        await db.marketplaceOfferingPage.update({
          where: { offeringId: p.offering.id },
          data: {
            publishedRevision: revision,
            heroHeadline: 'M6 private draft never public',
          },
        });
        const result = await readPublishedProgram(db, p.offering.slug),
          text = JSON.stringify(result);
        assert.equal(result.program?.page.heroHeadline, null);
        for (const value of [
          'M6 private draft never public',
          p.course.id,
          p.user.id,
          p.intent.ref,
          p.proof,
        ])
          assert.ok(!text.includes(value));
      },
    );
    await t.test(
      'learner rebinding/duplicate creator, Student ID mutation and immutable audit/payment rows are rejected',
      async () => {
        const p = await m6Flow(db, { role: 'INSTRUCTOR' }),
          { order, sessionId } = await p.pay();
        await p.payments.reconcile(order.ref, p.user.id);
        await new MarketplaceDeliveryService(db).reconcile({
          ownerId: p.user.id,
        });
        const d = await db.marketplaceDelivery.findFirstOrThrow({
            where: { entitlement: { userId: p.user.id } },
          }),
          other = await m6Flow(db);
        await assert.rejects(
          db.marketplaceLearnerIdentity.update({
            where: { userId: p.user.id },
            data: { userId: other.user.id },
          }),
        );
        await assert.rejects(
          db.marketplaceLearnerIdentity.create({
            data: { userId: other.user.id, createdByDeliveryId: d.id },
          }),
        );
        await assert.rejects(
          db.user.update({
            where: { id: p.user.id },
            data: { studentId: 'ST-2026-999999999' },
          }),
        );
        const event = p.provider.event(
          sessionId,
          'payment.captured',
          `evt_${randomUUID()}`,
        );
        await p.payments.consumeWebhook(event.raw, event.headers);
        const stored = await db.marketplacePaymentEvent.findFirstOrThrow({
          where: { providerSessionId: sessionId },
        });
        await assert.rejects(
          db.marketplacePaymentEvent.create({
            data: {
              provider: stored.provider,
              merchantRef: stored.merchantRef,
              providerEventId: stored.providerEventId,
              kind: stored.kind,
              eventType: stored.eventType,
              payloadDigest: stored.payloadDigest,
            },
          }),
        );
        await assert.rejects(
          db.marketplacePaymentEvent.delete({ where: { id: stored.id } }),
        );
        const audit = await db.marketplaceCommerceEvent.findFirstOrThrow({
          where: {
            orderId: (
              await db.marketplaceOrder.findUniqueOrThrow({
                where: { publicRef: order.ref },
              })
            ).id,
          },
        });
        await assert.rejects(
          db.marketplaceCommerceEvent.update({
            where: { id: audit.id },
            data: { safeCode: 'TAMPERED' },
          }),
        );
        await assert.rejects(
          db.marketplaceCommerceEvent.delete({ where: { id: audit.id } }),
        );
      },
    );
    await t.test(
      'pg-adapter serialization/deadlock errors are bounded and retry safe for anonymous starts',
      async () => {
        for (const originalCode of ['40001', '40P01']) {
          const p = await m6Flow(db);
          let attempts = 0;
          const proxy = new Proxy(db, {
            get(target, key) {
              if (key === '$transaction')
                return (...args: Parameters<typeof db.$transaction>) => {
                  if (attempts++ === 0)
                    return Promise.reject({ cause: { originalCode } });
                  return Reflect.apply(target.$transaction, target, args);
                };
              return Reflect.get(target, key);
            },
          });
          const started = await new EnrollmentService(proxy).start(
            null,
            'a'.repeat(64),
            { slug: p.offering.slug },
          );
          assert.ok(started.ref);
          assert.equal(attempts, 2);
        }
      },
    );
  } finally {
    await f.cleanup();
  }
});

test('M6 clean and pre-Marketplace populated upgrade preserve records and all 24 approved checksums', async () => {
  const f = await isolatedDatabase(
      undefined,
      '20261101093000_student_id_prefix_st',
    ),
    db = f.db;
  try {
    const user = await db.user.create({
        data: {
          clerkUserId: `pre-marketplace_${randomUUID()}`,
          lmsAccessOverride: 'ENABLED',
        },
      }),
      profile = await db.studentProfile.create({
        data: { userId: user.id, institution: 'Preserved institution' },
      });
    const course = await db.course.create({
        data: {
          title: 'Existing course',
          description: 'Retained history',
          thumbnailPath: '/images/campus.webp',
          thumbnailAlt: 'Campus',
          publicPath: '/#programs',
          published: true,
        },
      }),
      enrollment = await db.enrollment.create({
        data: { userId: user.id, courseId: course.id, status: 'IN_PROGRESS' },
      });
    cli(f.url, ['migrate', 'deploy']);
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
    assert.deepEqual(
      await db.studentProfile.findUniqueOrThrow({ where: { userId: user.id } }),
      profile,
    );
    assert.deepEqual(
      await db.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
      enrollment,
    );
    assert.equal(await db.marketplaceEntitlement.count(), 0);
    assert.match(
      cli(f.url, [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ]),
      /No difference/,
    );
    const baseline = JSON.parse(
      readFileSync('docs/reviews/marketplace-m6/baseline.json', 'utf8'),
    ) as Record<string, string>;
    const historical = Object.keys(baseline).filter((x) =>
      /^prisma\/migrations\/.*\/migration.sql$/.test(x),
    );
    assert.equal(historical.length, 24);
    for (const file of historical)
      assert.equal(
        createHash('sha256').update(readFileSync(file)).digest('hex'),
        baseline[file],
      );
    const rows = migrationManifest.map((x) => ({
      migration_name: x.name,
      checksum: x.checksum,
      finished_at: new Date(),
      rolled_back_at: null,
    }));
    assert.deepEqual(requireMarketplaceHardeningBaseline(rows.slice(0, 24)), [
      '20261119120000_marketplace_delivery_activation_guard',
    ]);
    assert.deepEqual(requireMarketplaceHardeningBaseline(rows), []);
    assert.throws(() => requireMarketplaceHardeningBaseline(rows.slice(0, 23)));
  } finally {
    await f.cleanup();
  }
});

for (const atomic of [true, false])
  test(`M6 migration failure rehearsal ${atomic ? 'explicit transaction rollback' : 'committed partial DDL'}: failed ledger blocks blind rerun`, async () => {
    const f = await isolatedDatabase(),
      scratch = mkdtempSync(join(tmpdir(), 'mentoralm-m6-recovery-'));
    try {
      const migrations = join(scratch, 'migrations');
      mkdirSync(migrations);
      for (const name of readdirSync('prisma/migrations'))
        cpSync(join('prisma/migrations', name), join(migrations, name), {
          recursive: true,
        });
      const name = '99991231000000_m6_synthetic_recovery',
        dir = join(migrations, name);
      mkdirSync(dir);
      const statements = atomic
        ? 'BEGIN; CREATE TABLE "M6AtomicProbe" (id text); CREATE TYPE "M6AtomicEnum" AS ENUM (\'ONE\'); ALTER TYPE "M6AtomicEnum" ADD VALUE \'TWO\'; SELECT m6_missing_function(); COMMIT;'
        : 'CREATE TABLE "M6PartialProbe" (id text); COMMIT; SELECT m6_missing_function();';
      writeFileSync(join(dir, 'migration.sql'), statements);
      const config = join(scratch, 'prisma.config.ts');
      writeFileSync(
        config,
        `export default { schema: ${JSON.stringify(resolve('prisma/schema.prisma'))}, migrations: { path: ${JSON.stringify(migrations)} }, datasource: { url: process.env.DATABASE_URL } };`,
      );
      let failed = false;
      try {
        cli(f.url, ['migrate', 'deploy', '--config', config]);
      } catch {
        failed = true;
      }
      assert.equal(failed, true);
      const ledger = await f.db.$queryRawUnsafe<
        { finished_at: Date | null; rolled_back_at: Date | null }[]
      >(
        `SELECT finished_at,rolled_back_at FROM "${f.schema}"."_prisma_migrations" WHERE migration_name=$1`,
        name,
      );
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0].finished_at, null);
      assert.equal(ledger[0].rolled_back_at, null);
      let blocked = false;
      try {
        cli(f.url, ['migrate', 'deploy', '--config', config]);
      } catch (error) {
        blocked = String(error).includes('P3009');
      }
      assert.equal(blocked, true);
      const table = atomic ? 'M6AtomicProbe' : 'M6PartialProbe',
        present = await f.db.$queryRawUnsafe<{ exists: boolean }[]>(
          'SELECT to_regclass($1) IS NOT NULL AS exists',
          `"${f.schema}"."${table}"`,
        );
      assert.equal(present[0].exists, !atomic);
      if (atomic) {
        cli(f.url, [
          'migrate',
          'resolve',
          '--rolled-back',
          name,
          '--config',
          config,
        ]);
        writeFileSync(
          join(dir, 'migration.sql'),
          'BEGIN; CREATE TABLE "M6AtomicProbe" (id text); COMMIT;',
        );
        cli(f.url, ['migrate', 'deploy', '--config', config]);
        const after = await f.db.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT count(*) AS count FROM "${f.schema}"."_prisma_migrations" WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL`,
          name,
        );
        assert.equal(Number(after[0].count), 1);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
      await f.cleanup();
    }
  });
