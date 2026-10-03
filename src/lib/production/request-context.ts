import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { LogContext } from './logging';
import { log } from './logging';
export const requestContext = new AsyncLocalStorage<LogContext>();
export function logUnavailable(code: string) {
  log('error', 'dependency_unavailable', {
    ...requestContext.getStore(),
    code,
  });
}
export async function withRequestContext(
  request: Request,
  operation: () => Promise<Response>,
) {
  const started = performance.now(),
    raw = request.headers.get('x-mentoralm-request-id'),
    requestId = raw && /^[a-f0-9-]{36}$/.test(raw) ? raw : crypto.randomUUID(),
    host = (request.headers.get('host') || '').split(':')[0];
  return requestContext.run(
    {
      requestId,
      domain: [
        'mentoralm.com',
        'students.mentoralm.com',
        'admin.mentoralm.com',
      ].includes(host)
        ? host
        : 'local',
      route: new URL(request.url).pathname,
    },
    async () => {
      try {
        const response = await operation();
        response.headers.set('X-Request-ID', requestId);
        log(response.status >= 500 ? 'error' : 'info', 'request', {
          ...requestContext.getStore(),
          status: response.status,
          durationMs: performance.now() - started,
        });
        return response;
      } catch {
        log('error', 'request_error', {
          ...requestContext.getStore(),
          code: 'UNHANDLED',
          durationMs: performance.now() - started,
        });
        return Response.json(
          { error: 'Service temporarily unavailable.' },
          {
            status: 503,
            headers: {
              'Cache-Control': 'private, no-store',
              'X-Request-ID': requestId,
            },
          },
        );
      }
    },
  );
}
