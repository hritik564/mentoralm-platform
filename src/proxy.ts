import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from 'next/server';
import { infrastructureProbePath } from '@/lib/production/infrastructure-probe';
import { securityHeaders } from '@/lib/production/security';
import { validateEnvironment } from '@/lib/production/config';
import { log } from '@/lib/production/logging';
import { isAuthConfigured } from '@/lib/auth/config';
import { lmsAuthPath, lmsReturn } from '@/lib/auth/lms-entry';
import { dashboardDestination } from '@/lib/auth/redirects';
import {
  adminSignInPath,
  adminDestination,
  domainRoute,
  approvedRequestHost,
  authorizedSessionParties,
  trustedRequestOrigin,
} from '@/lib/platform/domains';

const dashboard = createRouteMatcher([
  '/dashboard(.*)',
  '/learn(.*)',
  '/admin',
  '/admin/(.*)',
]);
const withClerk = clerkMiddleware(
  async (auth, request) => {
    const plan = domainRoute(
      request.headers.get('host') || request.nextUrl.host,
      request.nextUrl.pathname,
    );
    if (plan.kind === 'redirect')
      return NextResponse.redirect(
        new URL(
          plan.path,
          trustedRequestOrigin(
            request.headers.get('host') || request.nextUrl.host,
          ),
        ),
      );
    if (
      dashboard(request) ||
      plan.path === '/admin' ||
      plan.path.startsWith('/admin/') ||
      plan.path === '/learn' ||
      plan.path.startsWith('/learn/')
    ) {
      const session = await auth();
      if (!session.userId) return loginRedirect(request, plan.path);
    }
    if (plan.kind === 'rewrite') {
      const url = request.nextUrl.clone();
      url.pathname = plan.path;
      return NextResponse.rewrite(url, {
        request: { headers: request.headers },
      });
    }
    return NextResponse.next({ request: { headers: request.headers } });
  },
  { authorizedParties: authorizedSessionParties() },
);

function loginRedirect(request: NextRequest, path = request.nextUrl.pathname) {
  const url = new URL(
    path === '/admin' || path.startsWith('/admin/')
      ? adminSignInPath(request.headers.get('host') || request.nextUrl.host)
      : path === '/learn' || path.startsWith('/learn/')
        ? lmsAuthPath(
            'sign-in',
            request.headers.get('host') || request.nextUrl.host,
          )
        : '/sign-in',
    trustedRequestOrigin(request.headers.get('host') || request.nextUrl.host),
  );
  url.searchParams.set(
    'redirect_url',
    path === '/admin' || path.startsWith('/admin/')
      ? adminDestination(path)
      : path === '/learn' || path.startsWith('/learn/')
        ? lmsReturn(path).internal
        : dashboardDestination(path),
  );
  return NextResponse.redirect(url);
}

function handleProxy(request: NextRequest, event: NextFetchEvent) {
  const infrastructurePath = infrastructureProbePath(
    request.headers.get('host') || request.nextUrl.host,
    request.nextUrl.pathname,
    request.method,
  );
  if (infrastructurePath) {
    if (infrastructurePath === request.nextUrl.pathname)
      return NextResponse.next({ request: { headers: request.headers } });
    const url = request.nextUrl.clone();
    url.pathname = infrastructurePath;
    url.search = '';
    return NextResponse.rewrite(url, { request: { headers: request.headers } });
  }
  if (!approvedRequestHost(request.headers.get('host') || request.nextUrl.host))
    return new NextResponse('Unavailable host.', { status: 400 });
  if (
    request.nextUrl.pathname.startsWith('/_next/') ||
    /^\/(?:brand|images)\//.test(request.nextUrl.pathname) ||
    request.nextUrl.pathname === '/favicon.png' ||
    ['/api/health', '/api/readiness'].includes(request.nextUrl.pathname)
  )
    return NextResponse.next({ request: { headers: request.headers } });
  if (!isAuthConfigured()) {
    const plan = domainRoute(
      request.headers.get('host') || request.nextUrl.host,
      request.nextUrl.pathname,
    );
    if (plan.kind === 'redirect')
      return NextResponse.redirect(
        new URL(
          plan.path,
          trustedRequestOrigin(
            request.headers.get('host') || request.nextUrl.host,
          ),
        ),
      );
    if (
      dashboard(request) ||
      plan.path === '/admin' ||
      plan.path.startsWith('/admin/') ||
      plan.path === '/learn' ||
      plan.path.startsWith('/learn/')
    )
      return loginRedirect(request, plan.path);
    if (plan.kind === 'rewrite') {
      const url = request.nextUrl.clone();
      url.pathname = plan.path;
      return NextResponse.rewrite(url, {
        request: { headers: request.headers },
      });
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }
  return withClerk(request, event);
}

/** Always generate IDs at the application boundary; caller IDs/forwarded authorities are untrusted. */
export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const requestId = crypto.randomUUID(),
    started = performance.now(),
    host = request.headers.get('host') || request.nextUrl.host;
  request.headers.set('x-mentoralm-request-id', requestId);
  request.headers.delete('x-forwarded-host');
  try {
    validateEnvironment();
    const response =
      (await handleProxy(request, event)) ||
      NextResponse.next({ request: { headers: request.headers } });
    response.headers.set('X-Request-ID', requestId);
    const hsts = securityHeaders()['Strict-Transport-Security'];
    if (hsts) response.headers.set('Strict-Transport-Security', hsts);
    log('info', 'request', {
      requestId,
      domain: [
        'mentoralm.com',
        'students.mentoralm.com',
        'admin.mentoralm.com',
      ].includes(host)
        ? host
        : 'local',
      route: request.nextUrl.pathname,
      status: response.status,
      durationMs: performance.now() - started,
      code: 'PROXY',
    });
    return response;
  } catch {
    log('error', 'request_error', { requestId, code: 'PROXY_UNAVAILABLE' });
    return NextResponse.json(
      { error: 'Service temporarily unavailable.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId },
      },
    );
  }
}

// Host validation also covers public assets; they bypass Clerk after the host check.
export const config = { matcher: ['/:path*'] };
