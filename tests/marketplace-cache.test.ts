// Match Next's server bootstrap before importing its AsyncLocalStorage users.
import 'next/dist/server/node-environment-baseline';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { isolatedDatabase } from './helpers/d4-database';
import { AdminMarketplace } from '../src/lib/marketplace/admin';
import { readPublishedOfferings } from '../src/lib/marketplace/queries';
import {
  MARKETPLACE_CACHE_SECONDS,
  MARKETPLACE_CACHE_TAG,
} from '../src/lib/marketplace/cache';
import { createMarketplaceMutationRunner } from '../src/lib/marketplace/mutation';
import { StudentError } from '../src/lib/student/errors';
import type {
  PublicOffering,
  OfferingInput,
} from '../src/lib/marketplace/types';
import {
  harness,
  SharedGeneration,
  empty,
  publicFixture,
  deferred,
  type Query,
} from './helpers/marketplace-cache';

test('Next data cache reuses normalized public options across separate requests with a finite tagged TTL', async (t) => {
  const cache = await harness(t);
  let calls = 0;
  const read = cache.cached(async (query) => {
    calls += 1;
    return empty(query);
  });
  const first = await cache.request(() => read({}));
  assert.deepEqual(
    await cache.request(() => read({ page: 1, limit: 20 })),
    first,
  );
  assert.deepEqual(await cache.request(() => read({})), first);
  assert.equal(
    calls,
    1,
    'separate requests must share the real Next data-cache entry',
  );
  assert.equal(MARKETPLACE_CACHE_SECONDS, 300);
  const entries = await cache.storedEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].revalidate, MARKETPLACE_CACHE_SECONDS);
  assert.deepEqual(entries[0].tags, [MARKETPLACE_CACHE_TAG]);
});

test('Next data-cache keys keep featured, page and limit variants separate', async (t) => {
  const cache = await harness(t);
  const queries: Query[] = [];
  const read = cache.cached(async (query) => {
    queries.push(query);
    return empty(query);
  });
  const variants = [
    {},
    { page: 2 },
    { limit: 6 },
    { featured: true, limit: 6 },
    { featured: false, limit: 6 },
  ];
  for (const options of variants) await cache.request(() => read(options));
  for (const options of variants) await cache.request(() => read(options));
  assert.equal(queries.length, variants.length);
  assert.equal((await cache.storedEntries()).length, variants.length);
});

test('Publish, unpublish and archive expiry refresh every populated public-cache variant', async (t) => {
  const cache = await harness(t);
  type Fixture = {
    slug: string;
    publication: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
  };
  const rows: Fixture[] = [
    { slug: 'first', publication: 'PUBLISHED' },
    { slug: 'second', publication: 'DRAFT' },
    { slug: 'never-visible', publication: 'ARCHIVED' },
  ];
  let calls = 0;
  const read = cache.cached(async (query) => {
    calls += 1;
    const published = rows.filter((row) => row.publication === 'PUBLISHED');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offerings: PublicOffering[] = published
      .slice((page - 1) * limit, page * limit)
      .map(({ slug }) => ({
        slug,
        title: slug,
        shortDescription: 'Public catalogue fixture',
        category: 'Technology',
        cardImage: null,
        heroImage: null,
        deliveryMode: 'ONLINE',
        durationLabel: 'Six weeks',
        priceMinor: 0,
        currency: 'INR',
        availabilityStatus: 'CLOSED',
        cohortStartsAt: null,
      }));
    return {
      status: 'ready',
      offerings,
      total: published.length,
      page,
    };
  });
  const surfaces = [{}, { featured: true, limit: 6 }];
  async function expectSlugs(expected: string[]) {
    for (const options of surfaces) {
      const result = await cache.request(() => read(options));
      assert.deepEqual(
        result.offerings.map(({ slug }) => slug),
        expected,
      );
      assert.equal(result.total, expected.length);
    }
  }

  await expectSlugs(['first']);
  await expectSlugs(['first']);
  assert.equal(calls, 2);

  rows[1].publication = 'PUBLISHED';
  await expectSlugs(['first']);
  await cache.expire();
  await expectSlugs(['first', 'second']);
  await expectSlugs(['first', 'second']);
  assert.equal(calls, 4);

  rows[0].publication = 'UNPUBLISHED';
  await cache.expire();
  await expectSlugs(['second']);
  await expectSlugs(['second']);
  assert.equal(calls, 6);

  rows[1].publication = 'ARCHIVED';
  await cache.expire();
  await expectSlugs([]);
  await expectSlugs([]);
  assert.equal(calls, 8);
});

test('A failed cold loader is not cached and the next request can recover', async (t) => {
  const cache = await harness(t);
  let calls = 0;
  const read = cache.cached(async (query) => {
    calls += 1;
    if (calls === 1) throw new Error('offline fixture failure');
    return empty(query);
  });
  await assert.rejects(cache.request(() => read({})));
  assert.deepEqual(await cache.storedEntries(), []);
  assert.equal((await cache.request(() => read({}))).status, 'ready');
  assert.equal((await cache.request(() => read({}))).status, 'ready');
  assert.equal(calls, 2);
});

test('Immediate expiry blocks an old success during loader failure and does not cache the failure', async (t) => {
  const cache = await harness(t);
  let calls = 0;
  let fail = false;
  const read = cache.cached(async (query) => {
    calls += 1;
    if (fail) throw new Error('offline fixture failure after unpublish');
    return empty(query);
  });
  await cache.request(() => read({}));
  fail = true;
  await cache.expire();
  await assert.rejects(
    cache.request(() => read({})),
    'must not serve the pre-mutation cached success',
  );
  assert.equal(calls, 2);
  fail = false;
  assert.equal((await cache.request(() => read({}))).status, 'ready');
  assert.equal((await cache.request(() => read({}))).status, 'ready');
  assert.equal(calls, 3);
});

test('An in-flight pre-unpublish fill is neither returned nor reused after immediate expiry', async (t) => {
  const cache = await harness(t);
  const started = deferred();
  const finish = deferred();
  let published: string | null = 'previously-published';
  let calls = 0;
  const read = cache.cached(async (query) => {
    calls += 1;
    const result = publicFixture(published, query);
    if (calls === 1) {
      started.resolve();
      await finish.promise;
    }
    return result;
  });
  const inFlight = cache.request(() => read({ featured: true, limit: 6 }));
  await started.promise;
  published = null;
  await cache.expire();
  finish.resolve();
  assert.deepEqual((await inFlight).offerings, []);
  assert.deepEqual(
    (await cache.request(() => read({ featured: true, limit: 6 }))).offerings,
    [],
  );
  assert.equal(
    calls,
    2,
    'the old fill must retry once, then the fresh result is reused',
  );
});

test('Multiple invalidations during successive in-flight fills return and reuse only the latest generation', async (t) => {
  const cache = await harness(t);
  const started = [deferred(), deferred()];
  const finish = [deferred(), deferred()];
  let published: string | null = 'before-first-mutation';
  let calls = 0;
  const read = cache.cached(async (query) => {
    const invocation = calls++;
    const result = publicFixture(published, query);
    if (invocation < started.length) {
      started[invocation].resolve();
      await finish[invocation].promise;
    }
    return result;
  });
  const inFlight = cache.request(() => read({ featured: true, limit: 6 }));
  await started[0].promise;
  published = null;
  await cache.expire();
  finish[0].resolve();
  await started[1].promise;
  published = 'after-second-mutation';
  await cache.expire();
  finish[1].resolve();
  assert.deepEqual(
    (await inFlight).offerings.map(({ slug }) => slug),
    ['after-second-mutation'],
  );
  assert.deepEqual(
    (
      await cache.request(() => read({ featured: true, limit: 6 }))
    ).offerings.map(({ slug }) => slug),
    ['after-second-mutation'],
  );
  assert.equal(calls, 3);
});

test('Real PostgreSQL homepage reads reuse the Next cache and committed lifecycle changes refresh its public DTO', async (t) => {
  const generation = new SharedGeneration();
  const cache = await harness(t, generation);
  const secondInstance = await harness(t, generation);
  const runMutation = createMarketplaceMutationRunner(generation);
  const fixture = await isolatedDatabase();
  try {
    const actor = await fixture.db.user.create({
      data: {
        clerkUserId: `m1_cache_${randomUUID()}`,
        roleAssignments: { create: { role: 'ADMIN' } },
        adminAuthorization: {
          create: { permissions: ['MARKETPLACE_MANAGE'] },
        },
      },
    });
    const service = new AdminMarketplace(fixture.db, actor.id);
    const input: OfferingInput = {
      title: 'Isolated cache proof',
      slug: 'isolated-cache-proof',
      shortDescription: 'Test-only offering in a disposable PostgreSQL schema.',
      category: 'Technology',
      cardImage: null,
      heroImage: null,
      deliveryMode: 'ONLINE',
      durationLabel: 'Six weeks',
      priceMinor: 1500000,
      currency: 'INR',
      availabilityStatus: 'OPEN',
      featured: true,
      sortOrder: 0,
      lmsEnabled: false,
      courseRef: null,
      cohortStartsAt: null,
    };
    const id = await runMutation(() => service.save(null, input));
    assert.equal(generation.increments, 1);
    let findManyQueries = 0;
    let countQueries = 0;
    const measured = fixture.db.$extends({
      query: {
        marketplaceOffering: {
          async findMany({ args, query }) {
            findManyQueries += 1;
            return query(args);
          },
          async count({ args, query }) {
            countQueries += 1;
            return query(args);
          },
        },
      },
    });
    // Prisma extensions preserve these queries but omit the unused event API
    // from their client type. No production reader or client is replaced.
    const loader = (options: Query) =>
      readPublishedOfferings(measured as unknown as typeof fixture.db, options);
    const read = cache.cached(loader);
    const readSecondInstance = secondInstance.cached(loader);

    let expectedTitle = input.title;
    async function expectPublic(slugs: string[], reads: number) {
      for (const [instance, reader] of [
        [cache, read],
        [secondInstance, readSecondInstance],
      ] as const) {
        const result = await instance.request(() =>
          reader({ featured: true, limit: 6 }),
        );
        assert.deepEqual(
          result.offerings.map((offering) => offering.slug),
          slugs,
        );
        assert.equal(result.total, slugs.length);
        for (const offering of result.offerings) {
          assert.equal(offering.priceMinor, 1500000);
          assert.equal(offering.title, expectedTitle);
          for (const field of [
            'id',
            'ref',
            'revision',
            'courseId',
            'courseRef',
            'lmsEnabled',
            'publicationStatus',
            'publishedAt',
          ])
            assert.equal(field in offering, false);
        }
      }
      assert.equal(findManyQueries, reads * 2);
      assert.equal(countQueries, reads * 2);
      assert.equal(generation.increments, reads);
    }

    await expectPublic([], 1);
    await expectPublic([], 1);
    assert.equal(findManyQueries + countQueries, 4);

    await runMutation(async () =>
      service.publish(id, {
        revision: (await service.detail(id)).revision,
      }),
    );
    await expectPublic([input.slug], 2);

    expectedTitle = 'Updated public catalogue title';
    await runMutation(async () =>
      service.save(id, {
        ...input,
        title: expectedTitle,
        revision: (await service.detail(id)).revision,
      }),
    );
    await expectPublic([input.slug], 3);

    await runMutation(async () =>
      service.unpublish(id, {
        revision: (await service.detail(id)).revision,
      }),
    );
    await expectPublic([], 4);

    await runMutation(async () =>
      service.publish(id, {
        revision: (await service.detail(id)).revision,
      }),
    );
    await expectPublic([input.slug], 5);

    await runMutation(async () =>
      service.archive(id, {
        revision: (await service.detail(id)).revision,
      }),
    );
    await expectPublic([], 6);
    await expectPublic([], 6);
    assert.equal(findManyQueries + countQueries, 24);
    assert.equal(generation.increments, 6);
    const beforeFailure = generation.increments;
    await assert.rejects(
      runMutation(() => service.publish(id, { revision: randomUUID() })),
      (error: unknown) =>
        error instanceof StudentError && error.code === 'CONFLICT',
    );
    assert.equal(generation.increments, beforeFailure);
    assert.equal(generation.pending.size, 0);
    assert.equal(await fixture.db.academicAudit.count(), 6);
    assert.equal(await fixture.db.enrollment.count(), 0);
  } finally {
    await fixture.cleanup();
  }
});
