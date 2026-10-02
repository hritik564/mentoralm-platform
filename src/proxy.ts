import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from 'next/server';
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
      return NextResponse.redirect(new URL(plan.path, request.url));
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
      return NextResponse.rewrite(url);
    }
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

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!approvedRequestHost(request.headers.get('host') || request.nextUrl.host))
    return new NextResponse('Unavailable host.', { status: 400 });
  if (!isAuthConfigured()) {
    const plan = domainRoute(
      request.headers.get('host') || request.nextUrl.host,
      request.nextUrl.pathname,
    );
    if (plan.kind === 'redirect')
      return NextResponse.redirect(new URL(plan.path, request.url));
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
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }
  return withClerk(request, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|map|txt|xml)).*)',
    '/(api|trpc)(.*)',
  ],
};
