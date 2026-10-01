import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from 'next/server';
import { isAuthConfigured } from '@/lib/auth/config';
import { dashboardDestination } from '@/lib/auth/redirects';
import { domainRoute } from '@/lib/platform/domains';

const dashboard = createRouteMatcher(['/dashboard(.*)', '/learn(.*)']);
const withClerk = clerkMiddleware(async (auth, request) => {
  const plan = domainRoute(
    request.headers.get('host') || request.nextUrl.host,
    request.nextUrl.pathname,
  );
  if (plan.kind === 'redirect')
    return NextResponse.redirect(new URL(plan.path, request.url));
  if (
    dashboard(request) ||
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
});

function loginRedirect(request: NextRequest, path = request.nextUrl.pathname) {
  const url = new URL('/sign-in', request.url);
  url.searchParams.set('redirect_url', dashboardDestination(path));
  return NextResponse.redirect(url);
}

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!isAuthConfigured()) {
    const plan = domainRoute(
      request.headers.get('host') || request.nextUrl.host,
      request.nextUrl.pathname,
    );
    if (plan.kind === 'redirect')
      return NextResponse.redirect(new URL(plan.path, request.url));
    if (
      dashboard(request) ||
      plan.path === '/learn' ||
      plan.path.startsWith('/learn/')
    )
      return loginRedirect(request, plan.path);
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
