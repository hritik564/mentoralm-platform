import { withRequestContext } from '@/lib/production/request-context';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return withRequestContext(request, async () =>
    Response.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } },
    ),
  );
}
