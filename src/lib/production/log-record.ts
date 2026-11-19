/** Closed event/field vocabulary: never serialize exceptions, request bodies, URLs or env. */
export type LogEvent =
  | 'request'
  | 'request_error'
  | 'startup'
  | 'configuration_invalid'
  | 'dependency_unavailable'
  | 'marketplace_operation';
export interface LogContext {
  requestId?: string;
  domain?: string;
  route?: string;
  durationMs?: number;
  status?: number;
  code?: string;
}
const codes = new Set([
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
  'MARKETPLACE_CATALOGUE_UNAVAILABLE',

  'CONFIG_VALID',
  'CONFIG_INVALID',
  'UNHANDLED',
  'SERVER_ERROR',
  'PROXY',
  'PROXY_UNAVAILABLE',
  'READINESS_UNAVAILABLE',
  'STUDENT_API_UNAVAILABLE',
  'ADMIN_API_UNAVAILABLE',
]);
export function safeRoute(path: string) {
  const p = path.split('?')[0];
  if (p === '/api/health' || p === '/api/readiness') return p;
  for (const family of [
    '/api/marketplace',
    '/api/payments',
    '/enroll',
    '/checkout',
    '/orders',
    '/api/admin',
    '/api/lms',
    '/api/student',
    '/admin-auth',
    '/lms-auth',
    '/sign-in',
    '/sign-up',
    '/dashboard',
    '/learn',
    '/admin',
  ])
    if (p === family || p.startsWith(`${family}/`)) return `${family}/*`;
  return 'public';
}
export function logRecord(
  level: 'info' | 'warn' | 'error',
  event: LogEvent,
  context: LogContext = {},
) {
  return {
    timestamp: new Date().toISOString(),
    level: ['info', 'warn', 'error'].includes(level) ? level : 'error',
    event: [
      'request',
      'request_error',
      'startup',
      'configuration_invalid',
      'dependency_unavailable',
      'marketplace_operation',
    ].includes(event)
      ? event
      : 'request_error',
    ...(context.requestId && /^[a-f0-9-]{36}$/.test(context.requestId)
      ? { requestId: context.requestId }
      : {}),
    ...(context.domain &&
    [
      'mentoralm.com',
      'students.mentoralm.com',
      'admin.mentoralm.com',
      'local',
    ].includes(context.domain)
      ? { domain: context.domain }
      : {}),
    ...(context.route ? { route: safeRoute(context.route) } : {}),
    ...(context.durationMs !== undefined && Number.isFinite(context.durationMs)
      ? { durationMs: Math.max(0, Math.round(context.durationMs)) }
      : {}),
    ...(context.status !== undefined &&
    context.status >= 100 &&
    context.status <= 599
      ? { status: context.status }
      : {}),
    ...(context.code && codes.has(context.code) ? { code: context.code } : {}),
  };
}
