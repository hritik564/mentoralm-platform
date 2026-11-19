import 'next/dist/server/node-environment-baseline';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import {
  offeringInput,
  pageSettings,
  overviewSection,
  outcomesSection,
  marketplaceActor,
} from './helpers/marketplace-m2';
import { SharedGeneration, deferred } from './helpers/marketplace-cache';
import { AdminMarketplace } from '../src/lib/marketplace/admin';
import { AdminMarketplacePages } from '../src/lib/marketplace/admin-pages';
import { readPublishedProgram } from '../src/lib/marketplace/program-queries';
import { programPageSnapshotInput } from '../src/lib/marketplace/page-validation';
import { createMarketplaceMutationRunner } from '../src/lib/marketplace/mutation';
import { adminId } from '../src/lib/admin/handles';

test('editorial publish rechecks transactional authority, Offering visibility and owned snapshot inputs', async (t) => {
  const fixture = await isolatedDatabase(),
    db = fixture.db;
  try {
    const owner = await marketplaceActor(db);
    const catalogue = new AdminMarketplace(db, owner.id);
    const pages = new AdminMarketplacePages(db, owner.id);
    async function seed(slug: string, headline = pageSettings.heroHeadline) {
      const id = await catalogue.save(null, offeringInput(slug));
      await pages.saveSettings(id, {
        ...pageSettings,
        heroHeadline: headline,
        revision: null,
      });
      const draft = await pages.createSection(id, {
        ...overviewSection,
        revision: (await pages.detail(id)).revision,
      });
      return { id, draft };
    }
    const target = await seed('editorial-security-target');
    for (const revoke of ['capability', 'role'] as const) {
      await t.test(
        `publish denies a ${revoke} revoked after entry authorization and commits no snapshot or generation`,
        async () => {
          const actor = await marketplaceActor(db);
          let entered = false;
          class RevokedPublisher extends AdminMarketplacePages {
            override async authorize() {
              await super.authorize();
              entered = true;
              if (revoke === 'capability') {
                await db.adminAuthorization.update({
                  where: { userId: actor.id },
                  data: { permissions: ['ACADEMICS_MANAGE'] },
                });
              } else {
                await db.userRoleAssignment.delete({
                  where: { userId_role: { userId: actor.id, role: 'ADMIN' } },
                });
              }
            }
          }
          const before = await pages.detail(target.id),
            auditCount = await db.academicAudit.count();
          const generation = new SharedGeneration();
          const run = createMarketplaceMutationRunner(generation);
          await assert.rejects(
            run(() =>
              new RevokedPublisher(db, actor.id).publishPage(target.id, {
                revision: before.revision,
              }),
            ),
            { code: 'FORBIDDEN' },
          );
          assert.equal(entered, true);
          assert.deepEqual(await pages.detail(target.id), before);
          assert.equal(await db.marketplaceOfferingPageVersion.count(), 0);
          assert.equal(await db.academicAudit.count(), auditCount);
          assert.equal(generation.increments, 0);
          assert.equal(generation.pending.size, 0);
        },
      );
    }
    for (const status of ['DRAFT', 'UNPUBLISHED'] as const) {
      await t.test(
        `explicit editorial publish while Offering is ${status} remains private until Offering publication`,
        async () => {
          const slug = `editorial-security-${status.toLowerCase()}`;
          const { id, draft } = await seed(
            slug,
            `${status} explicitly published editorial headline`,
          );
          if (status === 'UNPUBLISHED') {
            await catalogue.publish(id, {
              revision: (await catalogue.detail(id)).revision,
            });
            await catalogue.unpublish(id, {
              revision: (await catalogue.detail(id)).revision,
            });
          }
          const parent = await catalogue.detail(id);
          const published = await pages.publishPage(id, {
            revision: draft.revision,
          });
          assert.equal(published.publishedRevision, draft.revision);
          assert.equal(published.editorialStatus, 'PUBLISHED');
          assert.equal(published.hasDraftChanges, false);
          assert.equal((await catalogue.detail(id)).publicationStatus, status);
          assert.equal((await catalogue.detail(id)).revision, parent.revision);
          assert.deepEqual(await readPublishedProgram(db, slug), {
            status: 'ready',
            program: null,
          });
          await catalogue.publish(id, { revision: parent.revision });
          const visible = await readPublishedProgram(db, slug);
          assert.ok(visible.program);
          assert.equal(
            visible.program.page.heroHeadline,
            published.heroHeadline,
          );
          assert.deepEqual(
            visible.program.page.sections.map((section) => section.title),
            [overviewSection.title],
          );
        },
      );
    }
    await t.test(
      'another Offering revision and injected snapshot fields cannot publish cross-owned content',
      async () => {
        const first = await seed(
          'editorial-security-owned-a',
          'Owned A private editorial headline',
        );
        const second = await seed(
          'editorial-security-owned-b',
          'Owned B private editorial headline',
        );
        const a = await pages.publishPage(first.id, {
          revision: first.draft.revision,
        });
        const auditCount = await db.academicAudit.count();
        await assert.rejects(
          pages.publishPage(second.id, { revision: a.publishedRevision }),
          { code: 'CONFLICT' },
        );
        const aVersion =
          await db.marketplaceOfferingPageVersion.findUniqueOrThrow({
            where: {
              pageId_revision: {
                pageId: first.id,
                revision: a.publishedRevision!,
              },
            },
          });
        await assert.rejects(
          pages.publishPage(second.id, {
            revision: second.draft.revision,
            pageId: first.id,
            snapshotJson: aVersion.snapshotJson,
          }),
          { code: 'INVALID_INPUT' },
        );
        assert.equal(await db.academicAudit.count(), auditCount);
        assert.equal(
          await db.marketplaceOfferingPageVersion.count({
            where: { pageId: second.id },
          }),
          0,
        );
        assert.equal((await pages.detail(second.id)).publishedRevision, null);
        const b = await pages.publishPage(second.id, {
          revision: second.draft.revision,
        });
        const bVersion =
          await db.marketplaceOfferingPageVersion.findUniqueOrThrow({
            where: {
              pageId_revision: {
                pageId: second.id,
                revision: b.publishedRevision!,
              },
            },
          });
        const snapshot = programPageSnapshotInput.parse(bVersion.snapshotJson);
        assert.equal(
          snapshot.settings.heroHeadline,
          'Owned B private editorial headline',
        );
        assert.ok(
          !JSON.stringify(snapshot).includes(
            'Owned A private editorial headline',
          ),
        );
        assert.equal(
          (await pages.detail(first.id)).publishedRevision,
          a.publishedRevision,
        );
      },
    );
    await t.test(
      'database snapshot envelope checks reject malformed immutable version inserts',
      async () => {
        const before = await db.marketplaceOfferingPageVersion.count({
          where: { pageId: target.id },
        });
        for (const snapshotJson of [
          { schemaVersion: 2, settings: pageSettings, sections: [] },
          { schemaVersion: 1, settings: [], sections: [] },
          {
            schemaVersion: 1,
            settings: pageSettings,
            sections: [],
            injected: 'unexpected',
          },
          {
            schemaVersion: 1,
            settings: pageSettings,
            sections: Array.from({ length: 21 }, () => overviewSection),
          },
        ]) {
          await assert.rejects(
            db.marketplaceOfferingPageVersion.create({
              data: { pageId: target.id, revision: randomUUID(), snapshotJson },
            }),
            (error: unknown) => {
              assert.ok(error instanceof Error);
              assert.ok(
                error.message.includes('marketplace_page_version_snapshot'),
              );
              return true;
            },
          );
        }
        assert.equal(
          await db.marketplaceOfferingPageVersion.count({
            where: { pageId: target.id },
          }),
          before,
        );
        assert.equal((await pages.detail(target.id)).publishedRevision, null);
      },
    );
    assert.equal(await db.enrollment.count(), 0);
    assert.equal(await db.learningItem.count(), 0);
  } finally {
    await fixture.cleanup();
  }
});

test('editorial publish and draft-save races preserve a complete revision without mixing draft fields', async (t) => {
  const fixture = await isolatedDatabase(),
    db = fixture.db;
  try {
    const actor = await marketplaceActor(db);
    const catalogue = new AdminMarketplace(db, actor.id);
    const pages = new AdminMarketplacePages(db, actor.id);
    async function seed(slug: string) {
      const id = await catalogue.save(null, offeringInput(slug));
      await pages.saveSettings(id, {
        ...pageSettings,
        heroHeadline: 'Accepted aggregate A headline',
        seoTitle: 'Accepted aggregate A SEO',
        revision: null,
      });
      for (const section of [overviewSection, outcomesSection])
        await pages.createSection(id, {
          ...section,
          revision: (await pages.detail(id)).revision,
        });
      await catalogue.publish(id, {
        revision: (await catalogue.detail(id)).revision,
      });
      return { id, draft: await pages.detail(id) };
    }
    await t.test(
      'a draft commit after publish reads the aggregate invalidates the publish revision and leaves no partial snapshot',
      async () => {
        const slug = 'editorial-race-save-first';
        const { id, draft } = await seed(slug);
        const started = deferred(),
          release = deferred();
        let pause = true;
        const measured = db.$extends({
          query: {
            marketplaceOfferingPage: {
              async findUnique({ args, query }) {
                const row = await query(args);
                if (pause && args.where.offeringId === id) {
                  pause = false;
                  started.resolve();
                  await release.promise;
                }
                return row;
              },
            },
          },
        });
        // Prisma extensions preserve transactional query interception; their client
        // type omits unrelated event APIs that this service never uses.
        const publisher = new AdminMarketplacePages(
          measured as unknown as typeof db,
          actor.id,
        );
        const generation = new SharedGeneration(),
          run = createMarketplaceMutationRunner(generation);
        const pending = Promise.allSettled([
          run(() => publisher.publishPage(id, { revision: draft.revision })),
        ]);
        await started.promise;
        try {
          let changed = await pages.saveSettings(id, {
            ...pageSettings,
            heroHeadline: 'Private aggregate B headline',
            seoTitle: 'Private aggregate B SEO',
            revision: draft.revision,
          });
          changed = await pages.updateSection(
            id,
            adminId('offering-section', changed.sections[0].ref),
            {
              ...overviewSection,
              title: 'Private aggregate B overview',
              content: { body: 'Private aggregate B body' },
              revision: changed.revision,
            },
          );
          await pages.reorderSections(id, {
            revision: changed.revision,
            sectionRefs: changed.sections
              .map((section) => section.ref)
              .reverse(),
          });
        } finally {
          release.resolve();
        }
        const [result] = await pending;
        assert.equal(result.status, 'rejected');
        if (result.status === 'rejected')
          assert.equal(result.reason.code, 'CONFLICT');
        assert.equal(generation.increments, 0);
        assert.equal(generation.pending.size, 0);
        assert.equal(
          await db.marketplaceOfferingPageVersion.count({
            where: { pageId: id },
          }),
          0,
        );
        const state = await pages.detail(id);
        assert.equal(state.publishedRevision, null);
        assert.equal(state.heroHeadline, 'Private aggregate B headline');
        assert.equal(state.editorialStatus, 'DRAFT_CHANGES');
        const publicPage = await readPublishedProgram(db, slug);
        assert.ok(publicPage.program);
        assert.equal(publicPage.program.page.heroHeadline, null);
        assert.deepEqual(publicPage.program.page.sections, []);
        assert.ok(!JSON.stringify(publicPage).includes('Private aggregate B'));
        assert.equal(
          await db.academicAudit.count({
            where: { targetId: id, action: 'MarketplacePagePublished' },
          }),
          0,
        );
      },
    );
    await t.test(
      'a complete publish winning before a pending draft save preserves aggregate A while aggregate B becomes private',
      async () => {
        const slug = 'editorial-race-publish-first';
        const { id, draft } = await seed(slug);
        const started = deferred(),
          release = deferred();
        let pause = true;
        const measured = db.$extends({
          query: {
            marketplaceOfferingPage: {
              async findUnique({ args, query }) {
                const row = await query(args);
                if (pause && args.where.offeringId === id) {
                  pause = false;
                  started.resolve();
                  await release.promise;
                }
                return row;
              },
            },
          },
        });
        const writer = new AdminMarketplacePages(
          measured as unknown as typeof db,
          actor.id,
        );
        const pending = Promise.allSettled([
          writer.saveSettings(id, {
            ...pageSettings,
            heroHeadline: 'Private aggregate B headline',
            seoTitle: 'Private aggregate B SEO',
            revision: draft.revision,
          }),
        ]);
        await started.promise;
        let published;
        try {
          published = await pages.publishPage(id, { revision: draft.revision });
        } finally {
          release.resolve();
        }
        const [result] = await pending;
        assert.equal(result.status, 'fulfilled');
        if (result.status !== 'fulfilled') return;
        let changed = await pages.updateSection(
          id,
          adminId('offering-section', result.value.sections[0].ref),
          {
            ...overviewSection,
            title: 'Private aggregate B overview',
            content: { body: 'Private aggregate B body' },
            revision: result.value.revision,
          },
        );
        changed = await pages.reorderSections(id, {
          revision: changed.revision,
          sectionRefs: changed.sections.map((section) => section.ref).reverse(),
        });
        assert.equal(changed.editorialStatus, 'DRAFT_CHANGES_SINCE_PUBLISH');
        assert.notEqual(changed.revision, draft.revision);
        assert.equal(changed.publishedRevision, published.publishedRevision);
        assert.equal(
          await db.marketplaceOfferingPageVersion.count({
            where: { pageId: id },
          }),
          1,
        );
        const stored =
          await db.marketplaceOfferingPageVersion.findUniqueOrThrow({
            where: {
              pageId_revision: { pageId: id, revision: draft.revision! },
            },
          });
        const snapshot = programPageSnapshotInput.parse(stored.snapshotJson);
        assert.equal(
          snapshot.settings.heroHeadline,
          'Accepted aggregate A headline',
        );
        assert.equal(snapshot.settings.seoTitle, 'Accepted aggregate A SEO');
        assert.deepEqual(
          snapshot.sections.map((section) => section.title),
          [overviewSection.title, outcomesSection.title],
        );
        assert.deepEqual(snapshot.sections[0].content, overviewSection.content);
        const publicPage = await readPublishedProgram(db, slug);
        assert.ok(publicPage.program);
        assert.equal(
          publicPage.program.page.heroHeadline,
          'Accepted aggregate A headline',
        );
        assert.deepEqual(
          publicPage.program.page.sections.map((section) => section.title),
          [overviewSection.title, outcomesSection.title],
        );
        assert.ok(!JSON.stringify(publicPage).includes('Private aggregate B'));
        assert.equal(
          await db.academicAudit.count({
            where: { targetId: id, action: 'MarketplacePagePublished' },
          }),
          1,
        );
      },
    );
  } finally {
    await fixture.cleanup();
  }
});
