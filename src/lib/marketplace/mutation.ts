import 'server-only';
import { randomUUID } from 'node:crypto';
import { platformEnvironment } from '../production/config';
import {
  UpstashMarketplaceGeneration,
  type MarketplaceGeneration,
} from '../production/marketplace-generation';
import { marketplaceDiagnostic } from './diagnostics';
import { StudentError } from '../student/errors';
import { expirePublicOfferings } from './cache';

/** Coordinate committed catalogue writes without weakening their transaction. */
export function createMarketplaceMutationRunner(
  generation: MarketplaceGeneration,
  options: {
    afterCommit?: () => void;
    onCoordinationFailure?: () => void;
  } = {},
) {
  const unavailable = () => {
    try {
      options.onCoordinationFailure?.();
    } catch {
      // Diagnostic delivery cannot change a confirmed business commit.
    }
  };
  return async function run<T>(work: () => Promise<T>): Promise<T> {
    // A durable pending marker must be acknowledged before a DB write starts.
    // Missing/unavailable shared authority refuses the write before work runs.
    let ticket;
    try {
      ticket = await generation.begin(randomUUID());
    } catch (error) {
      unavailable();
      throw error;
    }
    let value: T;
    try {
      value = await work();
    } catch (error) {
      // Domain rejections cannot represent a committed write. Unknown database
      // failures can have an ambiguous COMMIT outcome: retain their marker.
      if (
        error instanceof StudentError &&
        ['INVALID_INPUT', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT'].includes(
          error.code,
        )
      ) {
        try {
          await generation.abort(ticket);
        } catch {
          unavailable();
        }
      } else unavailable();
      throw error;
    }
    try {
      // This is after the offering + audit transaction resolves successfully.
      // Finalization increments once and atomically clears only this marker.
      await generation.commit(ticket);
    } catch {
      // An unacknowledged finalize leaves either the old state dirty or the
      // advanced state clean. Both force safe cross-instance read behavior.
      // Do not tell the caller that an already committed DB write rolled back.
      unavailable();
    }
    try {
      options.afterCommit?.();
    } catch {
      unavailable();
    }
    return value;
  };
}

const coordinatedMutation = createMarketplaceMutationRunner(
  new UpstashMarketplaceGeneration(),
  {
    afterCommit: expirePublicOfferings,
    onCoordinationFailure: () =>
      marketplaceDiagnostic('MARKETPLACE_COORDINATION_UNAVAILABLE'),
  },
);

export async function withMarketplaceMutation<T>(work: () => Promise<T>) {
  if (platformEnvironment() === 'production') return coordinatedMutation(work);
  // Local/test has no Production provider credentials and never pretends to
  // coordinate Autoscale. Its preview uses uncached authoritative DB reads.
  const value = await work();
  expirePublicOfferings();
  return value;
}
