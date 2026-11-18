// Match Next's server bootstrap before importing its AsyncLocalStorage users.
import 'next/dist/server/node-environment-baseline';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createMarketplaceMutationRunner } from '../src/lib/marketplace/mutation';
import { publicResult } from '../src/lib/marketplace/public';
import { StudentError } from '../src/lib/student/errors';
import {
  UpstashMarketplaceGeneration,
  marketplaceGenerationScripts,
} from '../src/lib/production/marketplace-generation';
import { TestMarketplaceRedis } from './helpers/marketplace-generation';
import {
  deferred,
  harness,
  publicFixture,
  SharedGeneration,
  type Query,
  type Ready,
} from './helpers/marketplace-cache';

function catalogue(slug: string | null, query: Query): Ready {
  const result = publicFixture(slug || 'unused-fixture', query);
  return slug ? result : { ...result, offerings: [], total: 0 };
}

function slugs(result: Ready) {
  return result.offerings.map((offering) => offering.slug);
}

test('successful catalogue changes refresh two independent instance caches through shared generation alone', async (t) => {
  const generation = new SharedGeneration();
  const first = await harness(t, generation);
  const second = await harness(t, generation);
  const run = createMarketplaceMutationRunner(generation);
  let published: string | null = null;
  const calls = [0, 0];
  const readers = [first, second].map((instance, index) =>
    instance.cached(async (query) => {
      calls[index] += 1;
      return catalogue(published, query);
    }),
  );
  async function expectBoth(expected: string[]) {
    for (const [index, instance] of [first, second].entries()) {
      assert.deepEqual(
        slugs(
          await instance.request(() =>
            readers[index]({ featured: true, limit: 6 }),
          ),
        ),
        expected,
      );
    }
  }

  await expectBoth([]);
  await expectBoth([]);
  assert.deepEqual(calls, [1, 1]);
  for (const [next, expected] of [
    ['published', ['published']],
    ['edited', ['edited']],
    [null, []],
    ['republished', ['republished']],
    [null, []],
  ] as const) {
    await run(async () => {
      published = next;
    });
    await expectBoth([...expected]);
    const afterRefresh = [...calls];
    await expectBoth([...expected]);
    assert.deepEqual(calls, afterRefresh, 'the current generation is reused');
  }
  assert.deepEqual(calls, [6, 6]);
  assert.equal(generation.increments, 5);
  assert.equal(generation.pending.size, 0);
});

test('separate production generation adapters invalidate independent Next caches through the shared primary protocol', async (t) => {
  const redis = new TestMarketplaceRedis();
  const generationA = new UpstashMarketplaceGeneration(redis.command);
  const generationB = new UpstashMarketplaceGeneration(redis.command);
  assert.notEqual(generationA, generationB);
  const epoch = randomUUID();
  await generationA.initializeAfterQuiescence(null, epoch);
  const first = await harness(t, generationA);
  const second = await harness(t, generationB);
  // No local tag invalidation callback: only the shared provider protocol can
  // make a change on B visible to A's independently populated Next data cache.
  const runOnB = createMarketplaceMutationRunner(generationB);
  let publication: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED' = 'DRAFT';
  let title = 'Original public title';
  const calls = [0, 0];
  const readers = [first, second].map((instance, index) =>
    instance.cached(async (query) => {
      calls[index] += 1;
      const result = catalogue(
        publication === 'PUBLISHED' ? 'adapter-offering' : null,
        query,
      );
      if (result.offerings[0]) result.offerings[0].title = title;
      return result;
    }),
  );
  async function expectBoth(titles: string[]) {
    for (const [index, instance] of [first, second].entries()) {
      const result = await instance.request(() =>
        readers[index]({ featured: true, limit: 6 }),
      );
      assert.deepEqual(
        result.offerings.map((offering) => offering.title),
        titles,
      );
    }
  }
  await expectBoth([]);
  await expectBoth([]);
  assert.deepEqual(calls, [1, 1]);
  const changes = [
    {
      apply: () => {
        publication = 'PUBLISHED';
      },
      titles: ['Original public title'],
    },
    {
      apply: () => {
        title = 'Edited public title';
      },
      titles: ['Edited public title'],
    },
    {
      apply: () => {
        publication = 'UNPUBLISHED';
      },
      titles: [],
    },
    {
      apply: () => {
        publication = 'PUBLISHED';
      },
      titles: ['Edited public title'],
    },
    {
      apply: () => {
        publication = 'ARCHIVED';
      },
      titles: [],
    },
  ];
  for (const [index, change] of changes.entries()) {
    await second.request(() => runOnB(async () => change.apply()));
    await expectBoth(change.titles);
    await expectBoth(change.titles);
    assert.deepEqual(calls, [index + 2, index + 2]);
    assert.deepEqual(await generationA.snapshot(), {
      epoch,
      generation: String(index + 1),
      pending: 0,
    });
  }
  assert.equal(
    redis.calls.filter(
      (command) => command[1] === marketplaceGenerationScripts.commit,
    ).length,
    5,
  );
  assert.ok(redis.calls.every((command) => command[0] === 'EVAL'));
  assert.equal((await first.storedEntries()).length, 6);
  assert.equal((await second.storedEntries()).length, 6);
});

test('an old fill on one instance cannot survive a committed mutation on another instance', async (t) => {
  const generation = new SharedGeneration();
  const first = await harness(t, generation);
  const second = await harness(t, generation);
  const run = createMarketplaceMutationRunner(generation);
  const started = deferred();
  const release = deferred();
  let published: string | null = 'before-unpublish';
  let calls = 0;
  const read = first.cached(async (query) => {
    calls += 1;
    const snapshot = catalogue(published, query);
    if (calls === 1) {
      started.resolve();
      await release.promise;
    }
    return snapshot;
  });

  const inFlight = first.request(() => read({ featured: true, limit: 6 }));
  await started.promise;
  await second.request(() =>
    run(async () => {
      published = null;
    }),
  );
  release.resolve();
  assert.deepEqual(slugs(await inFlight), []);
  assert.deepEqual(
    slugs(await first.request(() => read({ featured: true, limit: 6 }))),
    [],
  );
  assert.equal(
    calls,
    2,
    'the late old result must be replaced and then cached',
  );
});

test('pending mutations bypass a populated instance cache until their shared marker is finalized', async (t) => {
  const generation = new SharedGeneration();
  const instance = await harness(t, generation);
  const started = deferred();
  const release = deferred();
  let published = 'before-edit';
  let calls = 0;
  const read = instance.cached(async (query) => {
    calls += 1;
    return catalogue(published, query);
  });
  const run = createMarketplaceMutationRunner(generation);
  await instance.request(() => read({}));
  const mutation = run(async () => {
    started.resolve();
    await release.promise;
    published = 'after-edit';
  });
  await started.promise;
  assert.equal(generation.pending.size, 1);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.deepEqual(slugs(await instance.request(() => read({}))), [
      'before-edit',
    ]);
  }
  assert.equal(
    calls,
    3,
    'dirty state uses authoritative reads on each request',
  );
  release.resolve();
  await mutation;
  assert.deepEqual(slugs(await instance.request(() => read({}))), [
    'after-edit',
  ]);
  await instance.request(() => read({}));
  assert.equal(calls, 4);
  assert.equal(generation.pending.size, 0);
});

for (const failure of ['snapshot', 'missing'] as const) {
  test(`${failure} coordination state bypasses old cache data without caching the fallback`, async (t) => {
    const generation = new SharedGeneration();
    const instance = await harness(t, generation);
    let published = 'cached-before-fault';
    let calls = 0;
    const read = instance.cached(async (query) => {
      calls += 1;
      return catalogue(published, query);
    });
    await instance.request(() => read({}));
    if (failure === 'snapshot') generation.snapshotFailure = true;
    else generation.missing = true;
    published = 'authoritative-during-fault';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.deepEqual(slugs(await instance.request(() => read({}))), [
        published,
      ]);
    }
    assert.equal(calls, 3);
    assert.equal((await instance.storedEntries()).length, 1);
  });
}

test('a failed generation recheck discards a successful local cache hit', async (t) => {
  const generation = new SharedGeneration();
  const instance = await harness(t, generation);
  let published = 'cached-before-recheck-failure';
  let calls = 0;
  const read = instance.cached(async (query) => {
    calls += 1;
    return catalogue(published, query);
  });
  await instance.request(() => read({}));
  published = 'authoritative-after-recheck-failure';
  const snapshot = generation.snapshot.bind(generation);
  let checks = 0;
  generation.snapshot = async () => {
    checks += 1;
    if (checks === 2) throw new Error('Generation recheck fixture failure');
    return snapshot();
  };
  assert.deepEqual(slugs(await instance.request(() => read({}))), [published]);
  assert.equal(calls, 2, 'the cached result cannot survive a failed recheck');
  assert.equal((await instance.storedEntries()).length, 1);
});

test('coordination and database failure preserve the honest public unavailable response', async (t) => {
  const generation = new SharedGeneration();
  generation.snapshotFailure = true;
  const instance = await harness(t, generation);
  let calls = 0;
  const read = instance.cached(async () => {
    calls += 1;
    throw new Error('Private database fixture diagnostics');
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.deepEqual(
      await instance.request(() => publicResult(() => read({}))),
      {
        status: 'unavailable',
      },
    );
  }
  assert.equal(calls, 2);
  assert.deepEqual(await instance.storedEntries(), []);
});

test('missing coordination refuses a mutation before its database work starts', async () => {
  const generation = new SharedGeneration();
  generation.missing = true;
  const run = createMarketplaceMutationRunner(generation);
  let workCalls = 0;
  await assert.rejects(
    run(async () => {
      workCalls += 1;
    }),
    (error: unknown) =>
      error instanceof StudentError && error.code === 'UNAVAILABLE',
  );
  assert.equal(workCalls, 0);
  assert.equal(generation.increments, 0);
});

for (const failure of ['before', 'after'] as const) {
  test(`an ambiguous ${failure}-finalize failure preserves a committed result and safe cross-instance reads`, async (t) => {
    const generation = new SharedGeneration();
    const first = await harness(t, generation);
    const second = await harness(t, generation);
    let published = 'before-commit';
    let calls = 0;
    let coordinationFailures = 0;
    const read = first.cached(async (query) => {
      calls += 1;
      return catalogue(published, query);
    });
    await first.request(() => read({}));
    generation.commitFailure = failure;
    const run = createMarketplaceMutationRunner(generation, {
      onCoordinationFailure: () => {
        coordinationFailures += 1;
      },
    });
    assert.equal(
      await second.request(() =>
        run(async () => {
          published = 'committed-after-edit';
          return 'committed-ref';
        }),
      ),
      'committed-ref',
    );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.deepEqual(slugs(await first.request(() => read({}))), [published]);
    }
    assert.equal(coordinationFailures, 1);
    assert.equal(generation.pending.size, failure === 'before' ? 1 : 0);
    assert.equal(generation.increments, failure === 'before' ? 0 : 1);
    assert.equal(calls, failure === 'before' ? 3 : 2);
    if (failure === 'before') {
      const state = await generation.snapshot();
      assert.equal(
        state?.pending,
        1,
        'healthy lookups still observe the durable marker',
      );
      generation.commitFailure = null;
      const [token] = generation.pending;
      await generation.commit({ epoch: generation.epoch, token });
      assert.deepEqual(slugs(await first.request(() => read({}))), [published]);
      await first.request(() => read({}));
      assert.equal(
        calls,
        4,
        'recovery finalization creates one reusable fresh cache entry',
      );
      assert.equal(generation.increments, 1);
      assert.equal(generation.pending.size, 0);
    }
  });
}

test('unknown database errors retain the pending marker because COMMIT may have succeeded', async (t) => {
  const generation = new SharedGeneration();
  const instance = await harness(t, generation);
  let published = 'before-ambiguous-commit';
  let calls = 0;
  const read = instance.cached(async (query) => {
    calls += 1;
    return catalogue(published, query);
  });
  await instance.request(() => read({}));
  const run = createMarketplaceMutationRunner(generation);
  const error = new Error('Database COMMIT acknowledgement was lost');
  await assert.rejects(
    run(async () => {
      published = 'possibly-committed';
      throw error;
    }),
    (actual: unknown) => actual === error,
  );
  assert.equal(generation.pending.size, 1);
  assert.equal(generation.increments, 0);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.deepEqual(slugs(await instance.request(() => read({}))), [
      published,
    ]);
  }
  assert.equal(calls, 3);
});

test('an unavailable domain error does not prove database rollback and keeps cache bypassed', async (t) => {
  const generation = new SharedGeneration();
  const instance = await harness(t, generation);
  let published = 'before-unavailable';
  let calls = 0;
  const read = instance.cached(async (query) => {
    calls += 1;
    return catalogue(published, query);
  });
  await instance.request(() => read({}));
  const run = createMarketplaceMutationRunner(generation);
  await assert.rejects(
    run(async () => {
      published = 'possibly-committed-before-unavailable';
      throw new StudentError('UNAVAILABLE');
    }),
    (error: unknown) =>
      error instanceof StudentError && error.code === 'UNAVAILABLE',
  );
  assert.equal(generation.pending.size, 1);
  assert.equal(generation.increments, 0);
  assert.deepEqual(slugs(await instance.request(() => read({}))), [published]);
  assert.equal(calls, 2);
});

test('a known domain rejection clears its marker without invalidating unchanged catalogue data', async (t) => {
  const generation = new SharedGeneration();
  const instance = await harness(t, generation);
  let calls = 0;
  const read = instance.cached(async (query) => {
    calls += 1;
    return catalogue('unchanged', query);
  });
  await instance.request(() => read({}));
  const run = createMarketplaceMutationRunner(generation);
  const conflict = new StudentError('CONFLICT');
  await assert.rejects(
    run(async () => {
      throw conflict;
    }),
    (error: unknown) => error === conflict,
  );
  assert.equal(generation.pending.size, 0);
  assert.equal(generation.increments, 0);
  assert.deepEqual(slugs(await instance.request(() => read({}))), [
    'unchanged',
  ]);
  assert.equal(calls, 1);
});

test('failed abort cleanup retains dirty state rather than trusting an old cached success', async (t) => {
  const generation = new SharedGeneration();
  const instance = await harness(t, generation);
  let calls = 0;
  let coordinationFailures = 0;
  const read = instance.cached(async (query) => {
    calls += 1;
    return catalogue('unchanged', query);
  });
  await instance.request(() => read({}));
  generation.abortFailure = true;
  const run = createMarketplaceMutationRunner(generation, {
    onCoordinationFailure: () => {
      coordinationFailures += 1;
    },
  });
  await assert.rejects(
    run(async () => {
      throw new StudentError('CONFLICT');
    }),
    (error: unknown) =>
      error instanceof StudentError && error.code === 'CONFLICT',
  );
  assert.equal(generation.pending.size, 1);
  assert.equal(coordinationFailures, 1);
  await instance.request(() => read({}));
  await instance.request(() => read({}));
  assert.equal(calls, 3);
});

test('explicit namespace rotation after quiescence cannot reuse an old generation-zero entry', async (t) => {
  const generation = new SharedGeneration();
  const first = await harness(t, generation);
  const second = await harness(t, generation);
  let published = 'old-namespace';
  const calls = [0, 0];
  const readers = [first, second].map((instance, index) =>
    instance.cached(async (query) => {
      calls[index] += 1;
      return catalogue(published, query);
    }),
  );
  for (const [index, instance] of [first, second].entries()) {
    await instance.request(() => readers[index]({}));
  }
  const oldEpoch = generation.epoch;
  generation.rotateEpoch();
  published = 'reinitialized-after-quiescence';
  assert.notEqual(generation.epoch, oldEpoch);
  assert.equal(generation.generation, 0);
  for (const [index, instance] of [first, second].entries()) {
    assert.deepEqual(slugs(await instance.request(() => readers[index]({}))), [
      published,
    ]);
  }
  assert.deepEqual(calls, [2, 2]);
});
