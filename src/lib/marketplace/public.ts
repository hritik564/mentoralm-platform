import 'server-only';
import { createHash } from 'node:crypto';
import { getDatabase } from '../db/client';
import { logUnavailable } from '../production/request-context';
import { readPublishedOfferings, type PublicOfferingsQuery } from './queries';
import { createPublicOfferingsCache } from './cache';
import type { PublicOfferingsResult } from './types';

export { readPublishedOfferings } from './queries';
// Cache files can survive server restarts. Separate database/schema targets without
// putting connection details in cache keys, logs or public data.
const scope = createHash('sha256')
  .update(process.env.DATABASE_URL || 'unconfigured')
  .digest('hex');
const cachedPublishedOfferings = createPublicOfferingsCache(
  (options) => readPublishedOfferings(getDatabase(), options),
  scope,
);

export async function publicResult(
  read: () => Promise<Extract<PublicOfferingsResult, { status: 'ready' }>>,
): Promise<PublicOfferingsResult> {
  try {
    return await read();
  } catch {
    logUnavailable('MARKETPLACE_CATALOGUE_UNAVAILABLE');
    return { status: 'unavailable' };
  }
}

/** Request-time catalogue reads remain uncached. */
export function getPublicOfferings(options: PublicOfferingsQuery = {}) {
  return publicResult(() => readPublishedOfferings(getDatabase(), options));
}

/** The homepage reuses only public successful data; failures stay outside cache. */
export function getCachedPublicOfferings(options: PublicOfferingsQuery = {}) {
  return publicResult(() => cachedPublishedOfferings(options));
}

export { getPublicProgram } from './program-public';
