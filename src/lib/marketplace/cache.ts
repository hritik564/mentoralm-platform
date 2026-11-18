import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { parseInput } from '../admin/validation';
import {
  UpstashMarketplaceGeneration,
  type MarketplaceGeneration,
  type MarketplaceSnapshot,
} from '../production/marketplace-generation';
import { publicOfferingsInput } from './validation';
import type { PublicOfferingsQuery } from './queries';
import type { PublicOfferingsResult } from './types';

export type { PublicOfferingsQuery } from './queries';
type PublishedOfferings = Extract<PublicOfferingsResult, { status: 'ready' }>;
export const MARKETPLACE_CACHE_TAG = 'marketplace-public-v1';
export const MARKETPLACE_CACHE_SECONDS = 300;
const sharedGeneration = new UpstashMarketplaceGeneration();

function sameGeneration(a: MarketplaceSnapshot, b: MarketplaceSnapshot | null) {
  return (
    b !== null &&
    b.pending === 0 &&
    a.epoch === b.epoch &&
    a.generation === b.generation
  );
}

/** Only successful Published DTOs enter Next's optional instance-local cache. */
export function createPublicOfferingsCache(
  read: (options: PublicOfferingsQuery) => Promise<PublishedOfferings>,
  scope = 'public',
  generation: MarketplaceGeneration = sharedGeneration,
) {
  const cached = unstable_cache(
    async (options: PublicOfferingsQuery, epoch: string, version: string) => {
      // Shared epoch/version are key arguments, so late fills stay in old keys.
      void epoch;
      void version;
      try {
        return await read(options);
      } catch {
        // Next can log background refresh errors: never retain DB diagnostics.
        throw new Error('Marketplace catalogue is temporarily unavailable.');
      }
    },
    [MARKETPLACE_CACHE_TAG, scope],
    { tags: [MARKETPLACE_CACHE_TAG], revalidate: MARKETPLACE_CACHE_SECONDS },
  );
  async function snapshot() {
    try {
      return await generation.snapshot();
    } catch {
      return null;
    }
  }
  return async (options: PublicOfferingsQuery = {}) => {
    const query = parseInput(publicOfferingsInput, options);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const before = await snapshot();
      if (!before || before.pending !== 0) return read(query);
      let result: PublishedOfferings | undefined;
      let failure: unknown;
      try {
        result = await cached(query, before.epoch, before.generation);
      } catch (error) {
        failure = error;
      }
      const after = await snapshot();
      if (!after || after.pending !== 0) return read(query);
      if (sameGeneration(before, after)) {
        if (failure !== undefined) throw failure;
        return result!;
      }
      // Another instance committed while this result was pending. Retry the
      // shared generation; never return or reuse that old generation's data.
    }
    // Bound retries during sustained editorial changes without failing the page.
    return read(query);
  };
}

/** Local optimization only; shared Upstash generation provides correctness. */
export function expirePublicOfferings() {
  revalidateTag(MARKETPLACE_CACHE_TAG, { expire: 0 });
}
