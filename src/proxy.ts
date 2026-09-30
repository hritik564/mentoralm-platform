import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from 'next/server';
import { isAuthConfigured } from '@/lib/auth/config';
import { dashboardDestination } from '@/lib/auth/redirects';

const dashboard = createRouteMatcher(['/dashboard(.*)']);
const withClerk = clerkMiddleware(async (auth, request) => {
  if (dashboard(request)) {
    const session = await auth();
    if (!session.userId) return loginRedirect(request);
  }
});

function loginRedirect(request: NextRequest) {
  const url = new URL('/sign-in', request.url);
  url.searchParams.set(
    'redirect_url',
    dashboardDestination(request.nextUrl.pathname),
  );
  return NextResponse.redirect(url);
}

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!isAuthConfigured()) {
    return dashboard(request) ? loginRedirect(request) : NextResponse.next();
  }
  return withClerk(request, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|map|txt|xml)).*)',
    '/(api|trpc)(.*)',
  ],
};
