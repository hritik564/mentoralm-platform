import { applicationReady } from '@/lib/production/readiness-server';
import { withRequestContext } from '@/lib/production/request-context';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return withRequestContext(request, async () => {
    const ready = await applicationReady();
    return Response.json(
      { status: ready ? 'ready' : 'unavailable' },
      { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  });
}
