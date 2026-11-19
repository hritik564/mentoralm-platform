import 'server-only';
import { log } from '../production/logging';
import { requestContext } from '../production/request-context';
export const marketplaceDiagnosticCodes = [
  'MARKETPLACE_WEBHOOK_REJECTED',
  'MARKETPLACE_WEBHOOK_FAILED',
  'MARKETPLACE_RECONCILIATION_NEEDED',
  'MARKETPLACE_RECONCILE_COMPLETE',
  'MARKETPLACE_PROVIDER_UNKNOWN',
  'MARKETPLACE_SETTLEMENT_REVIEW',
  'MARKETPLACE_DELIVERY_FAILED',
  'MARKETPLACE_DELIVERY_REVIEW',
  'MARKETPLACE_LEASE_STALE',
  'MARKETPLACE_CLEANUP_COMPLETE',
  'MARKETPLACE_COORDINATION_UNAVAILABLE',
] as const;
/** Bounded observation only: no identifiers, exceptions, bodies or business authority. */
export function marketplaceDiagnostic(
  code: (typeof marketplaceDiagnosticCodes)[number],
) {
  try {
    log(code.endsWith('_COMPLETE') ? 'info' : 'warn', 'marketplace_operation', {
      ...requestContext.getStore(),
      code,
    });
  } catch {
    // Logging/transport failure cannot alter an already committed financial/access result.
  }
}
