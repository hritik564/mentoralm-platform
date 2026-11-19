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
import type { PublicProgramResult } from './page-types';
import { publicProgramSlugInput } from './page-validation';

export type { PublicOfferingsQuery } from './queries';
type PublishedOfferings = Extract<PublicOfferingsResult, { status: 'ready' }>;
export const MARKETPLACE_CACHE_TAG = 'marketplace-public-v1';
export const MARKETPLACE_CACHE_SECONDS = 300;
// Older M2 cache entries may contain unpublished draft editorial data.
export const PROGRAM_CACHE_NAMESPACE = 'program:editorial-v1';
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
export function createMarketplacePublicCache<Input, Result>(
  read: (input: Input) => Promise<Result>,
  scope = 'public',
  generation: MarketplaceGeneration = sharedGeneration,
) {
  const cached = unstable_cache(
    async (input: Input, epoch: string, version: string) => {
      // Shared epoch/version are key arguments, so late fills stay in old keys.
      void epoch;
      void version;
      try {
        return await read(input);
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
  return async (input: Input) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const before = await snapshot();
      if (!before || before.pending !== 0) return read(input);
      let result: Result | undefined;
      let failure: unknown;
      try {
        result = await cached(input, before.epoch, before.generation);
      } catch (error) {
        failure = error;
      }
      const after = await snapshot();
      if (!after || after.pending !== 0) return read(input);
      if (sameGeneration(before, after)) {
        if (failure !== undefined) throw failure;
        return result!;
      }
      // Another instance committed while this result was pending. Retry the
      // shared generation; never return or reuse that old generation's data.
    }
    // Bound retries during sustained editorial changes without failing the page.
    return read(input);
  };
}

/** Catalogue normalization remains outside the common generation/cache engine. */
export function createPublicOfferingsCache(
  read: (options: PublicOfferingsQuery) => Promise<PublishedOfferings>,
  scope = 'public',
  generation: MarketplaceGeneration = sharedGeneration,
) {
  const cached = createMarketplacePublicCache(
    read,
    `catalogue:${scope}`,
    generation,
  );
  return (options: PublicOfferingsQuery = {}) =>
    cached(parseInput(publicOfferingsInput, options));
}

export function createPublicProgramCache(
  read: (
    slug: string,
  ) => Promise<Extract<PublicProgramResult, { status: 'ready' }>>,
  scope = 'public',
  generation: MarketplaceGeneration = sharedGeneration,
) {
  const cached = createMarketplacePublicCache(
    read,
    `${PROGRAM_CACHE_NAMESPACE}:${scope}`,
    generation,
  );
  return (
    slug: string,
  ): Promise<Extract<PublicProgramResult, { status: 'ready' }>> =>
    publicProgramSlugInput.safeParse(slug).success
      ? cached(slug)
      : Promise.resolve({ status: 'ready', program: null });
}

/** Local optimization only; shared Upstash generation provides correctness. */
export function expirePublicOfferings() {
  revalidateTag(MARKETPLACE_CACHE_TAG, { expire: 0 });
}
