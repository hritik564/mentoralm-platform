import type { Environment } from './config';
/** An exact configured deployment host can expose liveness/readiness only, never business/auth routes. */
export function infrastructureProbePath(
  host: string,
  path: string,
  method: string,
  env: Environment = process.env,
) {
  if (
    env.MENTORALM_ENV !== 'production' ||
    !env.REPLIT_BOOTSTRAP_HOST ||
    !/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\.replit\.app$/.test(
      env.REPLIT_BOOTSTRAP_HOST,
    ) ||
    host !== env.REPLIT_BOOTSTRAP_HOST ||
    !['GET', 'HEAD'].includes(method)
  )
    return null;
  if (path === '/') return '/api/health';
  return ['/api/health', '/api/readiness'].includes(path) ? path : null;
}
