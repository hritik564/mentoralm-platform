import 'next/dist/server/node-environment-baseline';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isolatedDatabase } from './helpers/d4-database';
import {
  offeringInput,
  pageSettings,
  overviewSection,
  outcomesSection,
  faqSection,
  marketplaceActor,
} from './helpers/marketplace-m2';
import { AdminMarketplace } from '../src/lib/marketplace/admin';
import { AdminMarketplacePages } from '../src/lib/marketplace/admin-pages';
import { readPublishedProgram } from '../src/lib/marketplace/program-queries';
import { programMetadata } from '../src/components/marketplace/program/metadata';
import { adminId } from '../src/lib/admin/handles';
import { SharedGeneration } from './helpers/marketplace-cache';
import { createMarketplaceMutationRunner } from '../src/lib/marketplace/mutation';
import { migrationManifest } from '../src/lib/production/migrations';
import {
  requireMarketplaceEditorialBaseline,
  requireMarketplacePageBaseline,
} from '../scripts/marketplace/safety';
const migration = '20261118120000_marketplace_editorial_versions';

test('editorial migration only adds nullable publication pointer, owned immutable version table and guards', () => {
  const sql = readFileSync(
    `prisma/migrations/${migration}/migration.sql`,
    'utf8',
  );
  assert.doesNotMatch(
    sql,
    /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\s+(?:TABLE|INTO|FROM|"Marketplace)/im,
  );
  assert.equal((sql.match(/CREATE TABLE/g) || []).length, 1);
  assert.match(sql, /ADD COLUMN "publishedRevision" UUID/);
  assert.match(sql, /FOREIGN KEY \("offeringId", "publishedRevision"\)/);
  assert.match(sql, /BEFORE UPDATE OR DELETE/);
  assert.match(sql, /BEFORE TRUNCATE/);
  assert.doesNotMatch(
    sql,
    /ALTER TABLE "(?:MarketplaceOffering"|Course|Enrollment|User)/,
  );
  const rows = migrationManifest
    .filter((m) => m.name <= migration)
    .map((m) => ({
      migration_name: m.name,
      checksum: m.checksum,
      finished_at: new Date(),
      rolled_back_at: null,
    }));
  // Historical task commands must refuse the newly pending M3 migration.
  assert.throws(() => requireMarketplaceEditorialBaseline(rows.slice(0, -1)));
  assert.throws(() => requireMarketplaceEditorialBaseline(rows));
  assert.deepEqual(
    requireMarketplaceEditorialBaseline(
      migrationManifest.map((m) => ({
        migration_name: m.name,
        checksum: m.checksum,
        finished_at: new Date(),
        rolled_back_at: null,
      })),
    ),
    [],
  );
  assert.throws(() =>
    requireMarketplaceEditorialBaseline([
      ...rows,
      {
        migration_name: '20261119090000_marketplace_enrollment_intents',
        checksum: 'untrusted',
        finished_at: new Date(),
        rolled_back_at: null,
      },
    ]),
  );
  assert.throws(() => requireMarketplaceEditorialBaseline(rows.slice(0, -2)));
  assert.throws(() => requireMarketplacePageBaseline(rows.slice(0, -1)));
});

test('editorial drafts and immutable aggregate publishing enforce visibility, ownership, transaction integrity and history', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db;
  try {
    const actor = await marketplaceActor(db),
      academic = await marketplaceActor(db, ['ACADEMICS_MANAGE']),
      student = await db.user.create({
        data: { clerkUserId: `editorial_student_${randomUUID()}` },
      });
    const catalogue = new AdminMarketplace(db, actor.id),
      service = new AdminMarketplacePages(db, actor.id),
      id = await catalogue.save(null, offeringInput('editorial-program'));
    const state = () => service.detail(id),
      read = () => readPublishedProgram(db, 'editorial-program');
    await service.saveSettings(id, { ...pageSettings, revision: null });
    for (const section of [
      overviewSection,
      outcomesSection,
      { ...faqSection, enabled: false },
    ])
      await service.createSection(id, {
        ...section,
        revision: (await state()).revision,
      });
    let firstPublished: Awaited<ReturnType<typeof read>> | undefined;
    let firstRevision = '';
    await t.test(
      'Draft offering with rich draft content is never publicly accessible',
      async () => {
        assert.deepEqual(await read(), { status: 'ready', program: null });
        assert.equal(await db.marketplaceOfferingPageVersion.count(), 0);
        assert.equal((await state()).editorialStatus, 'DRAFT_CHANGES');
      },
    );
    await t.test(
      'publishing the Offering alone preserves basic fallback and never promotes editorial draft',
      async () => {
        await catalogue.publish(id, {
          revision: (await catalogue.detail(id)).revision,
        });
        const pub = await read();
        assert.ok(pub.program);
        assert.deepEqual(pub.program.page.sections, []);
        assert.equal(pub.program.page.heroHeadline, null);
        assert.equal(pub.program.page.seoTitle, null);
        assert.equal(await db.marketplaceOfferingPageVersion.count(), 0);
      },
    );
    await t.test(
      'draft settings and SEO cannot appear in public DTO or metadata channels',
      async () => {
        const pub = await read();
        assert.ok(pub.program);
        const meta = programMetadata(pub.program),
          serialized = JSON.stringify({ pub, meta });
        for (const forbidden of [
          pageSettings.heroHeadline,
          pageSettings.heroSummary,
          pageSettings.seoTitle,
          pageSettings.seoDescription,
          overviewSection.content.body,
          faqSection.content.items[0].answer,
        ])
          assert.ok(!serialized.includes(forbidden));
        assert.deepEqual(meta.title, {
          absolute: 'M2 Isolated Program | MentoraLM',
        });
        assert.equal(meta.description, offeringInput('x').shortDescription);
      },
    );
    await t.test(
      'academic-only and Student actors cannot save or publish drafts',
      async () => {
        for (const actorId of [academic.id, student.id]) {
          const denied = new AdminMarketplacePages(db, actorId);
          await assert.rejects(
            denied.saveSettings(id, {
              ...pageSettings,
              revision: (await state()).revision,
            }),
            { code: 'FORBIDDEN' },
          );
          await assert.rejects(
            denied.publishPage(id, { revision: (await state()).revision }),
            { code: 'FORBIDDEN' },
          );
        }
        assert.equal(await db.marketplaceOfferingPageVersion.count(), 0);
      },
    );
    await t.test(
      'explicit publish promotes settings and every section/order/enabled state as one aggregate',
      async () => {
        const before = await state();
        firstRevision = before.revision!;
        const published = await service.publishPage(id, {
          revision: firstRevision,
        });
        assert.equal(published.revision, firstRevision);
        assert.equal(published.publishedRevision, firstRevision);
        assert.equal(published.editorialStatus, 'PUBLISHED');
        assert.equal(published.hasDraftChanges, false);
        assert.ok(published.publishedAt);
        const versions = await db.marketplaceOfferingPageVersion.findMany({
          where: { pageId: id },
        });
        assert.equal(versions.length, 1);
        const snapshot = versions[0].snapshotJson as {
          schemaVersion: number;
          settings: unknown;
          sections: { title: string; enabled: boolean }[];
        };
        assert.equal(snapshot.schemaVersion, 1);
        assert.deepEqual(snapshot.settings, pageSettings);
        assert.deepEqual(
          snapshot.sections.map((s) => [s.title, s.enabled]),
          [
            [overviewSection.title, true],
            [outcomesSection.title, true],
            [faqSection.title, false],
          ],
        );
        firstPublished = await read();
        assert.ok(firstPublished.program);
        assert.equal(
          firstPublished.program.page.heroHeadline,
          pageSettings.heroHeadline,
        );
        assert.deepEqual(
          firstPublished.program.page.sections.map((s) => s.title),
          [overviewSection.title, outcomesSection.title],
        );
        assert.deepEqual(programMetadata(firstPublished.program).title, {
          absolute: pageSettings.seoTitle,
        });
      },
    );
    await t.test(
      'unchanged draft cannot be published again or create duplicate history',
      async () => {
        await assert.rejects(
          service.publishPage(id, { revision: firstRevision }),
          { code: 'CONFLICT' },
        );
        assert.equal(await db.marketplaceOfferingPageVersion.count(), 1);
      },
    );
    await t.test(
      'settings/section edits, enable and reorder remain draft-only until explicit publish',
      async () => {
        await service.saveSettings(id, {
          ...pageSettings,
          heroHeadline: 'Private next headline',
          seoTitle: 'PRIVATE_DRAFT_SEO_SENTINEL',
          revision: (await state()).revision,
        });
        let page = await state();
        await service.updateSection(
          id,
          adminId('offering-section', page.sections[0].ref),
          {
            ...overviewSection,
            title: 'Private next overview',
            content: { body: 'PRIVATE_DRAFT_BODY_SENTINEL' },
            revision: page.revision,
          },
        );
        page = await state();
        await service.setSectionEnabled(
          id,
          adminId('offering-section', page.sections[2].ref),
          { revision: page.revision, enabled: true },
        );
        page = await state();
        await service.reorderSections(id, {
          revision: page.revision,
          sectionRefs: page.sections.map((s) => s.ref).reverse(),
        });
        assert.deepEqual(await read(), firstPublished);
        assert.equal(
          (await state()).editorialStatus,
          'DRAFT_CHANGES_SINCE_PUBLISH',
        );
        assert.equal((await state()).hasDraftChanges, true);
        assert.equal(await db.marketplaceOfferingPageVersion.count(), 1);
      },
    );
    await t.test(
      'stale publication is rejected without a version, audit or generation increment',
      async () => {
        const generation = new SharedGeneration(),
          run = createMarketplaceMutationRunner(generation),
          before = await db.academicAudit.count();
        await assert.rejects(
          run(() => service.publishPage(id, { revision: firstRevision })),
          { code: 'CONFLICT' },
        );
        assert.equal(generation.increments, 0);
        assert.equal(generation.pending.size, 0);
        assert.equal(await db.academicAudit.count(), before);
        assert.equal(await db.marketplaceOfferingPageVersion.count(), 1);
        assert.deepEqual(await read(), firstPublished);
      },
    );
    await t.test(
      'shared coordination failure before write refuses before DB/audit work',
      async () => {
        const generation = new SharedGeneration();
        generation.missing = true;
        const run = createMarketplaceMutationRunner(generation),
          before = await db.academicAudit.count();
        let work = false;
        await assert.rejects(
          run(async () => {
            work = true;
            return service.publishPage(id, {
              revision: (await state()).revision,
            });
          }),
          { code: 'UNAVAILABLE' },
        );
        assert.equal(work, false);
        assert.equal(await db.academicAudit.count(), before);
        assert.deepEqual(await read(), firstPublished);
      },
    );
    await t.test(
      'audit insertion failure rolls back published version and pointer and advances no generation',
      async () => {
        const before = await state(),
          auditCount = await db.academicAudit.count(),
          generation = new SharedGeneration(),
          run = createMarketplaceMutationRunner(generation);
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${f.schema}".reject_editorial_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='MarketplacePagePublished' THEN RAISE EXCEPTION 'Editorial audit failure'; END IF; RETURN NEW; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER editorial_audit_failure BEFORE INSERT ON "${f.schema}"."AcademicAudit" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".reject_editorial_audit()`,
        );
        try {
          await assert.rejects(
            run(() => service.publishPage(id, { revision: before.revision })),
          );
          assert.deepEqual(await state(), before);
          assert.equal(await db.academicAudit.count(), auditCount);
          assert.equal(await db.marketplaceOfferingPageVersion.count(), 1);
          assert.equal(generation.increments, 0);
          assert.deepEqual(await read(), firstPublished);
        } finally {
          await db.$executeRawUnsafe(
            `DROP TRIGGER editorial_audit_failure ON "${f.schema}"."AcademicAudit"`,
          );
        }
      },
    );
    await t.test(
      'DB insertion failure rolls back publication and never advances generation',
      async () => {
        const before = await state(),
          generation = new SharedGeneration(),
          run = createMarketplaceMutationRunner(generation);
        await db.$executeRawUnsafe(
          `CREATE FUNCTION "${f.schema}".reject_editorial_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Editorial version failure'; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE TRIGGER editorial_version_failure BEFORE INSERT ON "${f.schema}"."MarketplaceOfferingPageVersion" FOR EACH ROW EXECUTE FUNCTION "${f.schema}".reject_editorial_version()`,
        );
        try {
          await assert.rejects(
            run(() => service.publishPage(id, { revision: before.revision })),
          );
          assert.equal(generation.increments, 0);
          assert.deepEqual(await state(), before);
          assert.equal(await db.marketplaceOfferingPageVersion.count(), 1);
          assert.deepEqual(await read(), firstPublished);
        } finally {
          await db.$executeRawUnsafe(
            `DROP TRIGGER editorial_version_failure ON "${f.schema}"."MarketplaceOfferingPageVersion"`,
          );
        }
      },
    );
    await t.test(
      'publish revalidates the entire draft, including disabled sections',
      async () => {
        const page = await state(),
          section = await db.marketplaceOfferingSection.findFirstOrThrow({
            where: { pageId: id },
          }),
          saved = section.contentJson;
        await db.marketplaceOfferingSection.update({
          where: { id: section.id },
          data: { enabled: false, contentJson: { unexpected: 'invalid' } },
        });
        try {
          await assert.rejects(
            service.publishPage(id, { revision: page.revision }),
          );
          assert.deepEqual(await read(), firstPublished);
          assert.equal(await db.marketplaceOfferingPageVersion.count(), 1);
        } finally {
          await db.marketplaceOfferingSection.update({
            where: { id: section.id },
            data: { contentJson: saved!, enabled: section.enabled },
          });
        }
      },
    );
    await t.test(
      'concurrent explicit publish commits one consistent version and increments shared generation once',
      async () => {
        const before = await state(),
          generation = new SharedGeneration(),
          run = createMarketplaceMutationRunner(generation);
        const results = await Promise.allSettled([
          run(() => service.publishPage(id, { revision: before.revision })),
          run(() => service.publishPage(id, { revision: before.revision })),
        ]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        const rejected = results.find((r) => r.status === 'rejected');
        assert.equal(rejected?.status, 'rejected');
        if (rejected?.status === 'rejected')
          assert.equal(rejected.reason.code, 'CONFLICT');
        assert.equal(generation.increments, 1);
        assert.equal(generation.pending.size, 0);
        assert.equal(await db.marketplaceOfferingPageVersion.count(), 2);
        const pub = await read();
        assert.ok(pub.program);
        assert.equal(pub.program.page.heroHeadline, 'Private next headline');
        assert.deepEqual(
          pub.program.page.sections.map((s) => s.title),
          [faqSection.title, outcomesSection.title, 'Private next overview'],
        );
        assert.equal(pub.program.page.seoTitle, 'PRIVATE_DRAFT_SEO_SENTINEL');
      },
    );
    await t.test(
      'superseded version remains historically identifiable and immutable to UPDATE/DELETE/TRUNCATE',
      async () => {
        const version =
          await db.marketplaceOfferingPageVersion.findUniqueOrThrow({
            where: { pageId_revision: { pageId: id, revision: firstRevision } },
          });
        assert.ok(
          JSON.stringify(version.snapshotJson).includes(
            pageSettings.heroHeadline,
          ),
        );
        await assert.rejects(
          db.marketplaceOfferingPageVersion.update({
            where: { pageId_revision: { pageId: id, revision: firstRevision } },
            data: { snapshotJson: { bad: true } },
          }),
        );
        await assert.rejects(
          db.marketplaceOfferingPageVersion.delete({
            where: { pageId_revision: { pageId: id, revision: firstRevision } },
          }),
        );
        await assert.rejects(
          db.$executeRawUnsafe(
            `TRUNCATE "${f.schema}"."MarketplaceOfferingPageVersion" CASCADE`,
          ),
        );
        assert.deepEqual(
          await db.marketplaceOfferingPageVersion.findUniqueOrThrow({
            where: { pageId_revision: { pageId: id, revision: firstRevision } },
          }),
          version,
        );
      },
    );
    await t.test(
      'cross-offering published-version pointer is independently rejected by PostgreSQL',
      async () => {
        const other = await catalogue.save(
          null,
          offeringInput('editorial-other'),
        );
        await service.saveSettings(other, { ...pageSettings, revision: null });
        await assert.rejects(
          db.marketplaceOfferingPage.update({
            where: { offeringId: other },
            data: { publishedRevision: firstRevision },
          }),
          { code: 'P2003' },
        );
        assert.equal((await service.detail(other)).publishedRevision, null);
      },
    );
    await t.test(
      'equivalent draft save creates no publishable changes or public generation increment',
      async () => {
        const before = await state();
        await service.saveSettings(id, {
          eyebrow: before.eyebrow,
          heroHeadline: before.heroHeadline,
          heroSummary: before.heroSummary,
          seoTitle: before.seoTitle,
          seoDescription: before.seoDescription,
          revision: before.revision,
        });
        const after = await state();
        assert.notEqual(after.revision, before.revision);
        assert.equal(after.hasDraftChanges, false);
        const generation = new SharedGeneration();
        await assert.rejects(
          createMarketplaceMutationRunner(generation)(() =>
            service.publishPage(id, { revision: after.revision }),
          ),
          { code: 'CONFLICT' },
        );
        assert.equal(generation.increments, 0);
      },
    );
    await t.test(
      'Offering unpublish/republish hides/restores latest explicit version and leaves newer draft private',
      async () => {
        const published = await read();
        await service.saveSettings(id, {
          ...pageSettings,
          seoTitle: 'FUTURE_UNPUBLISHED_EDITORIAL_SENTINEL',
          revision: (await state()).revision,
        });
        await catalogue.unpublish(id, {
          revision: (await catalogue.detail(id)).revision,
        });
        assert.deepEqual(await read(), { status: 'ready', program: null });
        await catalogue.publish(id, {
          revision: (await catalogue.detail(id)).revision,
        });
        assert.deepEqual(await read(), published);
        assert.ok(
          !JSON.stringify(await read()).includes(
            'FUTURE_UNPUBLISHED_EDITORIAL_SENTINEL',
          ),
        );
      },
    );
    await t.test(
      'archived Offering is unavailable and editorial draft/publish remain read-only',
      async () => {
        await catalogue.archive(id, {
          revision: (await catalogue.detail(id)).revision,
        });
        const before = await state();
        await assert.rejects(
          service.publishPage(id, { revision: before.revision }),
          { code: 'CONFLICT' },
        );
        await assert.rejects(
          service.saveSettings(id, {
            ...pageSettings,
            revision: before.revision,
          }),
          { code: 'CONFLICT' },
        );
        assert.deepEqual(await read(), { status: 'ready', program: null });
        assert.equal(await db.marketplaceOfferingPageVersion.count(), 2);
      },
    );
    await t.test(
      'draft and publish audit metadata contains bounded context and no editorial body/SEO copy',
      async () => {
        const events = await db.academicAudit.findMany({
          where: { action: { startsWith: 'Marketplace' } },
        });
        assert.equal(
          events.filter((e) => e.action === 'MarketplacePagePublished').length,
          2,
        );
        for (const action of [
          'MarketplacePageDraftUpdated',
          'MarketplaceSectionDraftCreated',
          'MarketplaceSectionDraftUpdated',
          'MarketplaceSectionDraftReordered',
          'MarketplaceSectionDraftEnabledChanged',
        ])
          assert.ok(
            events.some((e) => e.action === action),
            action,
          );
        for (const event of events) {
          const serialized = JSON.stringify(event.details);
          for (const value of [
            'PRIVATE_DRAFT_BODY_SENTINEL',
            'PRIVATE_DRAFT_SEO_SENTINEL',
            pageSettings.heroSummary,
            faqSection.content.items[0].answer,
          ])
            assert.ok(!serialized.includes(value));
        }
        assert.equal(await db.enrollment.count(), 0);
        assert.equal(await db.learningItem.count(), 0);
      },
    );
  } finally {
    await f.cleanup();
  }
});

test('editorial forward upgrade preserves populated M2 draft data and never silently publishes it', async () => {
  const f = await isolatedDatabase(
      undefined,
      '20261118110000_marketplace_page_content',
    ),
    db = f.db;
  try {
    const actor = await marketplaceActor(db),
      catalogue = new AdminMarketplace(db, actor.id),
      id = await catalogue.save(null, offeringInput('editorial-upgrade'));
    await catalogue.publish(id, {
      revision: (await catalogue.detail(id)).revision,
    });
    const revision = randomUUID();
    const before = await db.marketplaceOfferingPage.create({
      data: { offeringId: id, revision, ...pageSettings },
      select: {
        offeringId: true,
        revision: true,
        eyebrow: true,
        heroHeadline: true,
        heroSummary: true,
        seoTitle: true,
        seoDescription: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const { content, ...sectionFields } = overviewSection;
    const section = await db.marketplaceOfferingSection.create({
      data: { pageId: id, ...sectionFields, contentJson: content, position: 0 },
    });
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: f.url }, stdio: 'pipe' },
    );
    const after = await db.marketplaceOfferingPage.findUniqueOrThrow({
      where: { offeringId: id },
    });
    const { publishedRevision, ...rest } = after;
    assert.equal(publishedRevision, null);
    assert.deepEqual(rest, before);
    assert.deepEqual(
      await db.marketplaceOfferingSection.findUniqueOrThrow({
        where: { id: section.id },
      }),
      section,
    );
    assert.equal(await db.marketplaceOfferingPageVersion.count(), 0);
    const pub = await readPublishedProgram(db, 'editorial-upgrade');
    assert.ok(pub.program);
    assert.equal(pub.program.page.heroHeadline, null);
    assert.equal(pub.program.page.seoTitle, null);
    assert.deepEqual(pub.program.page.sections, []);
  } finally {
    await f.cleanup();
  }
});
