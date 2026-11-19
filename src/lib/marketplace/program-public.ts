import 'server-only';
import { createHash } from 'node:crypto';
import { cache } from 'react';
import { getDatabase } from '../db/client';
import { logUnavailable } from '../production/request-context';
import { createPublicProgramCache } from './cache';
import { readPublishedProgram } from './program-queries';
import type { PublicProgramResult } from './page-types';

const scope = createHash('sha256')
  .update(process.env.DATABASE_URL || 'unconfigured')
  .digest('hex');
const readCachedProgram = createPublicProgramCache(
  (slug) => readPublishedProgram(getDatabase(), slug),
  scope,
);

/** Call after the route's connection boundary; React coalesces page/metadata reads. */
export const getPublicProgram = cache(
  async (slug: string): Promise<PublicProgramResult> => {
    try {
      return await readCachedProgram(slug);
    } catch {
      logUnavailable('MARKETPLACE_CATALOGUE_UNAVAILABLE');
      return { status: 'unavailable' };
    }
  },
);
export { readPublishedProgram } from './program-queries';
