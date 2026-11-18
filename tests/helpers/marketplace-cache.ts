// Match Next's server bootstrap before importing its AsyncLocalStorage users.
import 'next/dist/server/node-environment-baseline';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { TestContext } from 'node:test';
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external';
import { createWorkStore } from 'next/dist/server/async-storage/work-store';
import { IncrementalCache } from 'next/dist/server/lib/incremental-cache';
import { nodeFs } from 'next/dist/server/lib/node-fs-methods';
import { executeRevalidates } from 'next/dist/server/revalidation-utils';
import {
  createPublicOfferingsCache,
  expirePublicOfferings,
  MARKETPLACE_CACHE_TAG,
} from '../../src/lib/marketplace/cache';
import type { MarketplaceGeneration } from '../../src/lib/production/marketplace-generation';
import { StudentError } from '../../src/lib/student/errors';
import type { PublicOfferingsResult } from '../../src/lib/marketplace/types';

export type Ready = Extract<PublicOfferingsResult, { status: 'ready' }>;
export type Loader = Parameters<typeof createPublicOfferingsCache>[0];
export type Query = Parameters<Loader>[0];

/** Shared authority test double: independent cache instances never share cache data. */
export class SharedGeneration implements MarketplaceGeneration {
  epoch = randomUUID();
  generation = 0;
  readonly pending = new Set<string>();
  snapshotFailure = false;
  missing = false;
  commitFailure: 'before' | 'after' | null = null;
  abortFailure = false;
  increments = 0;
  snapshots = 0;

  async snapshot() {
    this.snapshots += 1;
    if (this.snapshotFailure) throw new Error('Generation fixture unavailable');
    if (this.missing) return null;
    return {
      epoch: this.epoch,
      generation: String(this.generation),
      pending: this.pending.size,
    };
  }

  async begin(token: string) {
    if (this.missing) throw new StudentError('UNAVAILABLE');
    this.pending.add(token);
    return { epoch: this.epoch, token };
  }

  async commit(ticket: { epoch: string; token: string }) {
    if (this.commitFailure === 'before')
      throw new Error('Generation commit fixture failure');
    if (ticket.epoch !== this.epoch || this.missing)
      throw new StudentError('UNAVAILABLE');
    if (this.pending.delete(ticket.token)) {
      this.generation += 1;
      this.increments += 1;
    }
    if (this.commitFailure === 'after')
      throw new Error('Generation commit fixture response lost');
  }

  async abort(ticket: { epoch: string; token: string }) {
    if (this.abortFailure) throw new Error('Generation abort fixture failure');
    if (ticket.epoch !== this.epoch || this.missing)
      throw new StudentError('UNAVAILABLE');
    this.pending.delete(ticket.token);
  }

  async advance() {
    await this.commit(await this.begin(randomUUID()));
  }

  /** Models explicit initialization after quiescence, never automatic reader repair. */
  rotateEpoch() {
    this.epoch = randomUUID();
    this.generation = 0;
    this.pending.clear();
    this.missing = false;
  }
}

/** Real production-mode Next data cache; all files remain in an isolated temp directory. */
export async function harness(
  t: TestContext,
  generation: MarketplaceGeneration = new SharedGeneration(),
) {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'mentoralm-marketplace-cache-'),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  const preview = {
    previewModeId: 'offline-marketplace-cache-test',
    previewModeSigningKey: 'offline-signing-key',
    previewModeEncryptionKey: 'offline-encryption-key',
  };
  const incrementalCache = new IncrementalCache({
    fs: nodeFs,
    dev: false,
    flushToDisk: true,
    maxMemoryCacheSize: 0,
    serverDistDir: path.join(directory, 'server'),
    requestHeaders: {},
    previewProps: preview,
    prerenderManifest: {
      version: 4,
      routes: {},
      dynamicRoutes: {},
      notFoundRoutes: [],
      preview,
    },
  });
  assert.ok(
    incrementalCache.cacheHandler,
    'Next filesystem cache must be installed',
  );

  async function request<T>(run: () => Promise<T> | T): Promise<T> {
    const store = createWorkStore({
      page: '/api/admin/marketplace/route',
      renderOpts: {
        incrementalCache,
        cacheComponents: false,
        cacheLifeProfiles: {
          default: { stale: 300, revalidate: 900, expire: 4294967294 },
        },
        staticPageGenerationTimeout: 60,
        validationLevel: 'warning',
        experimental: {
          isRoutePPREnabled: false,
          authInterrupts: false,
          useCacheTimeout: 30,
          durableUseCacheEntries: false,
        },
        waitUntil: undefined,
        onAfterTaskError: undefined,
        onClose() {},
      },
      buildId: 'offline-test',
      deploymentId: 'offline-test',
      previouslyRevalidatedTags: [],
    });
    return workAsyncStorage.run(store, async () => {
      try {
        return await run();
      } finally {
        // App Router routes perform this same Next operation after a request.
        await executeRevalidates(store);
      }
    });
  }

  async function expire() {
    const ticket = await generation.begin(randomUUID());
    await generation.commit(ticket);
    await request(() => {
      expirePublicOfferings();
      assert.deepEqual(
        workAsyncStorage
          .getStore()
          ?.pendingRevalidatedTags?.map(({ tag, profile }) => ({
            tag,
            profile,
          })),
        [{ tag: MARKETPLACE_CACHE_TAG, profile: { expire: 0 } }],
      );
    });
  }

  async function storedEntries() {
    const cacheDirectory = path.join(directory, 'cache', 'fetch-cache');
    let names: string[];
    try {
      names = await readdir(cacheDirectory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return Promise.all(
      names.map(
        async (name) =>
          JSON.parse(
            await readFile(path.join(cacheDirectory, name), 'utf8'),
          ) as {
            revalidate: number;
            tags: string[];
          },
      ),
    );
  }

  return {
    request,
    expire,
    storedEntries,
    cached: (loader: Loader) =>
      createPublicOfferingsCache(loader, randomUUID(), generation),
  };
}

export function empty(query: Query): Ready {
  return { status: 'ready', offerings: [], total: 0, page: query.page ?? 1 };
}

export function publicFixture(slug: string | null, query: Query): Ready {
  if (!slug) return empty(query);
  return {
    status: 'ready',
    total: 1,
    page: query.page ?? 1,
    offerings: [
      {
        slug,
        title: slug,
        shortDescription: 'Public cache concurrency fixture',
        category: 'Technology',
        cardImage: null,
        heroImage: null,
        deliveryMode: 'ONLINE',
        durationLabel: 'Six weeks',
        priceMinor: 0,
        currency: 'INR',
        availabilityStatus: 'OPEN',
        cohortStartsAt: null,
      },
    ],
  };
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
