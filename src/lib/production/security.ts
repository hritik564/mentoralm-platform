import { platformEnvironment, type Environment } from './config';
export function securityHeaders(env: Environment = process.env) {
  const headers: Record<string, string> = {
    'Content-Security-Policy':
      "base-uri 'self'; object-src 'none'; frame-ancestors 'self'",
    'X-Content-Type-Options': 'nosniff',
    // SAMEORIGIN preserves authorized PDF iframe preview; cross-origin embedding is denied.
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=()',
  };
  if (
    platformEnvironment(env) === 'production' &&
    env.PRODUCTION_HTTPS_CONFIRMED === '1'
  )
    headers['Strict-Transport-Security'] = 'max-age=86400';
  return headers;
}
