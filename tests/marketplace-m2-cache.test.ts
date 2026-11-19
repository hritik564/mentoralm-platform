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
import {
  harness,
  SharedGeneration,
  deferred,
} from './helpers/marketplace-cache';
import { AdminMarketplace } from '../src/lib/marketplace/admin';
import { AdminMarketplacePages } from '../src/lib/marketplace/admin-pages';
import { readPublishedProgram } from '../src/lib/marketplace/program-queries';
import {
  createPublicProgramCache,
  createMarketplacePublicCache,
} from '../src/lib/marketplace/cache';
import { createMarketplaceMutationRunner } from '../src/lib/marketplace/mutation';
import { adminId } from '../src/lib/admin/handles';
import { UpstashMarketplaceGeneration } from '../src/lib/production/marketplace-generation';
import { TestMarketplaceRedis } from './helpers/marketplace-generation';

test('editorial draft saves leave two actual Next caches unchanged; explicit publishes alone advance shared public generation', async (t) => {
  const fixture = await isolatedDatabase(),
    db = fixture.db;
  try {
    const actor = await marketplaceActor(db),
      catalogue = new AdminMarketplace(db, actor.id),
      service = new AdminMarketplacePages(db, actor.id),
      id = await catalogue.save(null, offeringInput('m2-cache'));
    await catalogue.publish(id, {
      revision: (await catalogue.detail(id)).revision,
    });
    const redis = new TestMarketplaceRedis(),
      generationA = new UpstashMarketplaceGeneration(redis.command),
      generationB = new UpstashMarketplaceGeneration(redis.command);
    await generationA.initializeAfterQuiescence(null, randomUUID());
    const a = await harness(t, generationA),
      b = await harness(t, generationB),
      run = createMarketplaceMutationRunner(generationB),
      calls = [0, 0];
    const readers = [generationA, generationB].map((g, i) =>
      createPublicProgramCache(
        async (slug) => {
          calls[i]++;
          return readPublishedProgram(db, slug);
        },
        randomUUID(),
        g,
      ),
    );
    const both = () =>
      Promise.all(
        [a, b].map((instance, i) =>
          instance.request(() => readers[i]('m2-cache')),
        ),
      );
    const state = () => service.detail(id),
      publish = () =>
        run(async () =>
          service.publishPage(id, { revision: (await state()).revision }),
        );
    const initial = await both();
    await both();
    assert.deepEqual(calls, [1, 1]);
    await t.test(
      'page settings and new section draft writes never advance public generation',
      async () => {
        await service.saveSettings(id, { ...pageSettings, revision: null });
        for (const section of [overviewSection, outcomesSection])
          await service.createSection(id, {
            ...section,
            revision: (await state()).revision,
          });
        assert.deepEqual(await both(), initial);
        assert.equal((await generationA.snapshot())?.generation, '0');
        assert.deepEqual(calls, [1, 1]);
        assert.deepEqual(
          await readPublishedProgram(db, 'm2-cache'),
          initial[0],
        );
      },
    );
    await t.test(
      'draft edits, order and visibility changes remain hidden in warmed and authoritative reads',
      async () => {
        let page = await state();
        await service.updateSection(
          id,
          adminId('offering-section', page.sections[0].ref),
          {
            ...overviewSection,
            title: 'Changed cached overview',
            revision: page.revision,
          },
        );
        page = await state();
        await service.reorderSections(id, {
          revision: page.revision,
          sectionRefs: page.sections.map((s) => s.ref).reverse(),
        });
        page = await state();
        await service.setSectionEnabled(
          id,
          adminId('offering-section', page.sections[0].ref),
          { revision: page.revision, enabled: false },
        );
        assert.deepEqual(await both(), initial);
        assert.deepEqual(
          await readPublishedProgram(db, 'm2-cache'),
          initial[0],
        );
        assert.equal((await generationA.snapshot())?.generation, '0');
        assert.deepEqual(calls, [1, 1]);
      },
    );
    await t.test(
      'explicit editorial publish atomically changes both instances with exactly one increment',
      async () => {
        await publish();
        for (const v of await both()) {
          assert.equal(v.program?.page.heroHeadline, pageSettings.heroHeadline);
          assert.deepEqual(
            v.program?.page.sections.map((s) => s.title),
            ['Changed cached overview'],
          );
        }
        assert.equal((await generationA.snapshot())?.generation, '1');
        assert.deepEqual(calls, [2, 2]);
      },
    );
    await t.test(
      'subsequent draft settings/order/enabled changes preserve old version until next explicit publish',
      async () => {
        const old = await both();
        await service.saveSettings(id, {
          ...pageSettings,
          heroHeadline: 'Next published headline',
          revision: (await state()).revision,
        });
        let page = await state();
        await service.setSectionEnabled(
          id,
          adminId('offering-section', page.sections[0].ref),
          { revision: page.revision, enabled: true },
        );
        page = await state();
        await service.reorderSections(id, {
          revision: page.revision,
          sectionRefs: page.sections.map((s) => s.ref).reverse(),
        });
        assert.deepEqual(await both(), old);
        assert.equal((await generationA.snapshot())?.generation, '1');
        await publish();
        for (const v of await both()) {
          assert.equal(v.program?.page.heroHeadline, 'Next published headline');
          assert.deepEqual(
            v.program?.page.sections.map((s) => s.title),
            ['Changed cached overview', outcomesSection.title],
          );
        }
        assert.equal((await generationA.snapshot())?.generation, '2');
        assert.deepEqual(calls, [3, 3]);
      },
    );
    await t.test(
      'unchanged or stale publish advances no generation and changes no cached result',
      async () => {
        const old = await both();
        await assert.rejects(publish(), { code: 'CONFLICT' });
        assert.equal((await generationA.snapshot())?.generation, '2');
        assert.deepEqual(await both(), old);
        assert.deepEqual(calls, [3, 3]);
      },
    );
    await t.test(
      'Offering unpublish and republish keep M1 generation behavior and restore latest editorial version',
      async () => {
        await run(async () =>
          catalogue.unpublish(id, {
            revision: (await catalogue.detail(id)).revision,
          }),
        );
        for (const v of await both()) assert.equal(v.program, null);
        assert.equal((await generationA.snapshot())?.generation, '3');
        await run(async () =>
          catalogue.publish(id, {
            revision: (await catalogue.detail(id)).revision,
          }),
        );
        for (const v of await both())
          assert.equal(v.program?.page.heroHeadline, 'Next published headline');
        assert.equal((await generationA.snapshot())?.generation, '4');
      },
    );
  } finally {
    await fixture.cleanup();
  }
});

test('a slow old immutable published snapshot cannot resurrect after a new editorial publish', async (t) => {
  const f = await isolatedDatabase(),
    db = f.db;
  try {
    const actor = await marketplaceActor(db),
      catalogue = new AdminMarketplace(db, actor.id),
      pages = new AdminMarketplacePages(db, actor.id),
      id = await catalogue.save(null, offeringInput('m2-slow'));
    await pages.saveSettings(id, {
      ...pageSettings,
      heroHeadline: 'Old published headline',
      revision: null,
    });
    await pages.createSection(id, {
      ...overviewSection,
      revision: (await pages.detail(id)).revision,
    });
    await pages.publishPage(id, {
      revision: (await pages.detail(id)).revision,
    });
    await catalogue.publish(id, {
      revision: (await catalogue.detail(id)).revision,
    });
    const generation = new SharedGeneration(),
      a = await harness(t, generation),
      b = await harness(t, generation),
      started = deferred(),
      release = deferred(),
      run = createMarketplaceMutationRunner(generation);
    let calls = 0;
    const slow = createPublicProgramCache(
      async (slug) => {
        const observed = await readPublishedProgram(db, slug);
        calls++;
        if (calls === 1) {
          started.resolve();
          await release.promise;
        }
        return observed;
      },
      randomUUID(),
      generation,
    );
    const other = createPublicProgramCache(
      (slug) => readPublishedProgram(db, slug),
      randomUUID(),
      generation,
    );
    const old = a.request(() => slow('m2-slow'));
    await started.promise;
    await pages.saveSettings(id, {
      ...pageSettings,
      heroHeadline: 'New published headline',
      revision: (await pages.detail(id)).revision,
    });
    await run(async () =>
      pages.publishPage(id, { revision: (await pages.detail(id)).revision }),
    );
    assert.equal(
      (await b.request(() => other('m2-slow'))).program?.page.heroHeadline,
      'New published headline',
    );
    release.resolve();
    assert.equal(
      (await old).program?.page.heroHeadline,
      'New published headline',
    );
    assert.equal(calls, 2);
    assert.equal(
      (await a.request(() => slow('m2-slow'))).program?.page.heroHeadline,
      'New published headline',
    );
    assert.equal(calls, 2);
    assert.equal(generation.increments, 1);
  } finally {
    await f.cleanup();
  }
});

test('M2 detail cache fails to authoritative reads when shared generation is missing/dirty/unavailable', async (t) => {
  const generation = new SharedGeneration(),
    instance = await harness(t, generation);
  let calls = 0;
  const read = createPublicProgramCache(
    async () => {
      calls++;
      return { status: 'ready', program: null };
    },
    randomUUID(),
    generation,
  );
  for (const condition of ['missing', 'dirty', 'unavailable'] as const) {
    generation.missing = condition === 'missing';
    generation.snapshotFailure = condition === 'unavailable';
    generation.pending.clear();
    if (condition === 'dirty') generation.pending.add(randomUUID());
    await instance.request(() => read('m2-fallback'));
    await instance.request(() => read('m2-fallback'));
  }
  assert.equal(calls, 6);
  assert.equal((await instance.storedEntries()).length, 0);
});

test('editorial cache projection refuses pre-editorial draft DTOs at an unchanged shared generation', async (t) => {
  const generation = new SharedGeneration(),
    instance = await harness(t, generation),
    scope = randomUUID();
  const privateOld = {
    status: 'ready' as const,
    program: {
      ...offeringInput('upgrade-cache'),
      page: {
        eyebrow: null,
        heroHeadline: 'LEGACY_DRAFT_CACHE_SENTINEL',
        heroSummary: null,
        seoTitle: 'LEGACY_PRIVATE_SEO',
        seoDescription: null,
        sections: [],
      },
    },
  };
  const old = createMarketplacePublicCache(
    async () => privateOld,
    `program:${scope}`,
    generation,
  );
  assert.ok(
    JSON.stringify(await instance.request(() => old('upgrade-cache'))).includes(
      'LEGACY_DRAFT_CACHE_SENTINEL',
    ),
  );
  let calls = 0;
  const current = createPublicProgramCache(
    async () => {
      calls++;
      return { status: 'ready', program: null };
    },
    scope,
    generation,
  );
  assert.deepEqual(await instance.request(() => current('upgrade-cache')), {
    status: 'ready',
    program: null,
  });
  assert.equal(calls, 1);
  assert.equal(generation.increments, 0);
  assert.equal((await instance.storedEntries()).length, 2);
});
