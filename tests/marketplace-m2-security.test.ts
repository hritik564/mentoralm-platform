import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/d4-database';
import {
  marketplaceActor,
  offeringInput,
  overviewSection,
  pageSettings,
} from './helpers/marketplace-m2';
import { AdminMarketplace } from '../src/lib/marketplace/admin';
import { AdminMarketplacePages } from '../src/lib/marketplace/admin-pages';
import { createProgramSectionInput } from '../src/lib/marketplace/page-validation';
import { requestBody } from '../src/lib/student/http';
import {
  deploymentAdminOrigin,
  deploymentOrigins,
} from '../src/lib/platform/domains';
import { adminId } from '../src/lib/admin/handles';

function bodyRequest(
  body: string,
  originOverride?: string | null,
  contentType = 'application/json',
) {
  const origin =
    deploymentAdminOrigin() ||
    deploymentOrigins().website ||
    'http://127.0.0.1:3000';
  return new Request(`${origin}/api/admin/marketplace/offering/page/sections`, {
    method: 'POST',
    headers: {
      host: new URL(origin).host,
      'content-type': contentType,
      ...(originOverride === null ? {} : { origin: originOverride ?? origin }),
    },
    body,
  });
}
function faqPayload(answer: string, count: number) {
  return {
    revision: null,
    type: 'FAQ',
    title: 'Program questions',
    subtitle: null,
    enabled: true,
    content: {
      items: Array.from({ length: count }, (_, index) => ({
        question: `Question ${index + 1}?`,
        answer,
      })),
    },
  };
}
function constraint(name: string) {
  return (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes(name), `Expected ${name} constraint`);
    return true;
  };
}

test('M2 request-body security keeps the default limit and permits bounded structured page content', async (t) => {
  const payload = faqPayload('A'.repeat(2000), 9);
  const serialized = JSON.stringify(payload);
  assert.ok(Buffer.byteLength(serialized) > 18000);
  assert.ok(Buffer.byteLength(serialized) < 65536);
  assert.ok(createProgramSectionInput.safeParse(payload).success);

  await t.test(
    'the unchanged 16 KiB default rejects an otherwise valid 18 KB FAQ',
    async () => {
      await assert.rejects(requestBody(bodyRequest(serialized)), {
        code: 'INVALID_INPUT',
      });
      assert.deepEqual(await requestBody(bodyRequest('{"value":"small"}')), {
        value: 'small',
      });
    },
  );
  await t.test(
    'the explicit 64 KiB page limit accepts the same valid structured FAQ',
    async () => {
      const parsed = await requestBody(bodyRequest(serialized), 65536);
      assert.deepEqual(parsed, payload);
      assert.ok(createProgramSectionInput.safeParse(parsed).success);
    },
  );
  await t.test(
    'the page limit counts UTF-8 bytes and rejects a valid field-bounded FAQ over 64 KiB',
    async () => {
      const oversized = faqPayload('界'.repeat(2000), 12);
      const body = JSON.stringify(oversized);
      assert.ok(createProgramSectionInput.safeParse(oversized).success);
      assert.ok(body.length < 65536);
      assert.ok(Buffer.byteLength(body) > 65536);
      await assert.rejects(requestBody(bodyRequest(body), 65536), {
        code: 'INVALID_INPUT',
      });
    },
  );
  await t.test(
    'both body limits reject missing and cross-origin requests',
    async () => {
      for (const limit of [16384, 65536] as const) {
        for (const origin of [null, 'https://untrusted.example'])
          await assert.rejects(
            requestBody(bodyRequest('{"value":true}', origin), limit),
            { code: 'FORBIDDEN' },
          );
      }
    },
  );
  await t.test(
    'the larger bound preserves JSON content-type and parse checks',
    async () => {
      await assert.rejects(
        requestBody(
          bodyRequest('{"value":true}', undefined, 'text/plain'),
          65536,
        ),
        { code: 'INVALID_INPUT' },
      );
      await assert.rejects(requestBody(bodyRequest('{"invalid":'), 65536), {
        code: 'INVALID_INPUT',
      });
    },
  );
});

test('M2 first-page concurrency, transaction-time authority and database integrity', async (t) => {
  const fixture = await isolatedDatabase();
  const db = fixture.db;
  try {
    const owner = await marketplaceActor(db);
    const catalogue = new AdminMarketplace(db, owner.id);
    const pages = new AdminMarketplacePages(db, owner.id);
    const id = await catalogue.save(null, offeringInput('m2-security'));

    await t.test(
      'concurrent null-revision settings and section creation permit exactly one page/audit commit',
      async () => {
        let entered = 0;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        class ConcurrentPages extends AdminMarketplacePages {
          override async authorize() {
            await super.authorize();
            entered += 1;
            if (entered === 2) release();
            await gate;
          }
        }
        const beforeAudit = await db.academicAudit.count();
        const parentRevision = (await catalogue.detail(id)).revision;
        const results = await Promise.allSettled([
          new ConcurrentPages(db, owner.id).saveSettings(id, {
            ...pageSettings,
            revision: null,
          }),
          new ConcurrentPages(db, owner.id).createSection(id, {
            ...overviewSection,
            revision: null,
          }),
        ]);
        assert.equal(
          entered,
          2,
          'both requests passed entry authorization before either write',
        );
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        const rejected = results.find((result) => result.status === 'rejected');
        assert.ok(rejected?.status === 'rejected');
        assert.equal(rejected.reason.code, 'CONFLICT');
        const winner = results.find((result) => result.status === 'fulfilled');
        assert.ok(winner?.status === 'fulfilled');
        const stored = await pages.detail(id);
        assert.equal(stored.revision, winner.value.revision);
        assert.equal(
          await db.marketplaceOfferingPage.count({ where: { offeringId: id } }),
          1,
        );
        assert.equal(await db.academicAudit.count(), beforeAudit + 1);
        assert.equal((await catalogue.detail(id)).revision, parentRevision);
        if (results[0].status === 'fulfilled') {
          assert.equal(stored.heroHeadline, pageSettings.heroHeadline);
          assert.equal(stored.sections.length, 0);
        } else {
          assert.equal(stored.heroHeadline, null);
          assert.equal(stored.sections.length, 1);
          assert.deepEqual(stored.sections[0].content, overviewSection.content);
        }
      },
    );

    // Use a separate parent so authority/constraint tests never depend on which
    // legitimate first-page writer won the concurrent creation race above.
    const protectedId = await catalogue.save(
      null,
      offeringInput('m2-security-protected'),
    );
    const seeded = await pages.createSection(protectedId, {
      ...overviewSection,
      revision: null,
    });
    const sectionId = adminId('offering-section', seeded.sections[0].ref);
    const operations = {
      settings: (service: AdminMarketplacePages) =>
        service.saveSettings(protectedId, {
          ...pageSettings,
          revision: seeded.revision,
        }),
      create: (service: AdminMarketplacePages) =>
        service.createSection(protectedId, {
          ...overviewSection,
          revision: seeded.revision,
        }),
      update: (service: AdminMarketplacePages) =>
        service.updateSection(protectedId, sectionId, {
          ...overviewSection,
          title: 'Unauthorized update',
          revision: seeded.revision,
        }),
      enabled: (service: AdminMarketplacePages) =>
        service.setSectionEnabled(protectedId, sectionId, {
          revision: seeded.revision,
          enabled: false,
        }),
      reorder: (service: AdminMarketplacePages) =>
        service.reorderSections(protectedId, {
          revision: seeded.revision,
          sectionRefs: seeded.sections.map((section) => section.ref),
        }),
    };
    for (const [name, operation] of Object.entries(operations)) {
      await t.test(
        `${name} rechecks a revoked Marketplace capability inside the write transaction`,
        async () => {
          const actor = await marketplaceActor(db);
          let entryAuthorized = false;
          class RevokedPages extends AdminMarketplacePages {
            override async authorize() {
              await super.authorize();
              entryAuthorized = true;
              await db.adminAuthorization.update({
                where: { userId: actor.id },
                data: { permissions: ['ACADEMICS_MANAGE'] },
              });
            }
          }
          const before = await pages.detail(protectedId);
          const beforeAudit = await db.academicAudit.count();
          await assert.rejects(operation(new RevokedPages(db, actor.id)), {
            code: 'FORBIDDEN',
          });
          assert.equal(entryAuthorized, true);
          assert.deepEqual(await pages.detail(protectedId), before);
          assert.equal(await db.academicAudit.count(), beforeAudit);
        },
      );
    }
    await t.test(
      'a revoked effective Admin role cannot retain write access through a persisted Marketplace policy',
      async () => {
        const actor = await marketplaceActor(db);
        let entryAuthorized = false;
        class RevokedRolePages extends AdminMarketplacePages {
          override async authorize() {
            await super.authorize();
            entryAuthorized = true;
            await db.userRoleAssignment.delete({
              where: { userId_role: { userId: actor.id, role: 'ADMIN' } },
            });
          }
        }
        const before = await pages.detail(protectedId);
        const beforeAudit = await db.academicAudit.count();
        await assert.rejects(
          new RevokedRolePages(db, actor.id).saveSettings(protectedId, {
            ...pageSettings,
            revision: before.revision,
          }),
          { code: 'FORBIDDEN' },
        );
        assert.equal(entryAuthorized, true);
        assert.deepEqual(await pages.detail(protectedId), before);
        assert.equal(await db.academicAudit.count(), beforeAudit);
      },
    );
    await t.test(
      'database metadata bounds and JSON-object checks reject bypasses without changing stored content',
      async () => {
        const before = await db.marketplaceOfferingPage.findUniqueOrThrow({
          where: { offeringId: protectedId },
        });
        await assert.rejects(
          db.marketplaceOfferingPage.update({
            where: { offeringId: protectedId },
            data: { heroSummary: 'x'.repeat(1201) },
          }),
          constraint('marketplace_page_metadata_bounds'),
        );
        await assert.rejects(
          db.marketplaceOfferingSection.update({
            where: { id: sectionId },
            data: { contentJson: [] },
          }),
          constraint('marketplace_section_content_object'),
        );
        assert.deepEqual(
          await db.marketplaceOfferingPage.findUniqueOrThrow({
            where: { offeringId: protectedId },
          }),
          before,
        );
        assert.deepEqual(
          (
            await db.marketplaceOfferingSection.findUniqueOrThrow({
              where: { id: sectionId },
            })
          ).contentJson,
          overviewSection.content,
        );
      },
    );
    await t.test(
      'duplicate section positions and orphan references cannot be persisted',
      async () => {
        await assert.rejects(
          db.marketplaceOfferingSection.create({
            data: {
              pageId: protectedId,
              type: 'TEXT',
              title: 'Duplicate position',
              position: 0,
              enabled: true,
              contentJson: { body: 'This write must fail.' },
            },
          }),
          { code: 'P2002' },
        );
        await assert.rejects(
          db.marketplaceOfferingPage.create({
            data: {
              offeringId: `missing_${randomUUID()}`,
              revision: randomUUID(),
            },
          }),
          { code: 'P2003' },
        );
        assert.equal(
          await db.marketplaceOfferingSection.count({
            where: { pageId: protectedId },
          }),
          1,
        );
      },
    );
    await t.test(
      'restrict foreign keys prevent deleting a page with sections or its parent offering',
      async () => {
        await assert.rejects(
          db.marketplaceOfferingPage.delete({
            where: { offeringId: protectedId },
          }),
          { code: 'P2003' },
        );
        await assert.rejects(
          db.marketplaceOffering.delete({ where: { id: protectedId } }),
          { code: 'P2003' },
        );
        assert.ok(
          await db.marketplaceOffering.findUnique({
            where: { id: protectedId },
          }),
        );
        assert.ok(
          await db.marketplaceOfferingPage.findUnique({
            where: { offeringId: protectedId },
          }),
        );
        assert.ok(
          await db.marketplaceOfferingSection.findUnique({
            where: { id: sectionId },
          }),
        );
      },
    );
    assert.equal(await db.learningItem.count(), 0);
    assert.equal(await db.enrollment.count(), 0);
  } finally {
    await fixture.cleanup();
  }
});
