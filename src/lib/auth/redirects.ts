import {
  deploymentOrigins,
  lmsHref,
  lmsInternalPath,
} from '../platform/domains';
const destinations = new Set([
  '/dashboard',
  '/dashboard/courses',
  '/dashboard/resources',
  '/dashboard/support',
  '/dashboard/referral',
  '/dashboard/profile',
  '/learn',
  '/learn/lectures',
  '/learn/assignments',
  '/learn/resources',
  '/learn/discussions',
  '/learn/chat',
  '/learn/attendance',
  '/learn/certificates',
]);

/** Approved internal routes only; never follow arbitrary provider/query redirects. */
export function dashboardDestination(value: unknown): string {
  const origins = deploymentOrigins();
  if (
    typeof value === 'string' &&
    origins.lms &&
    value.startsWith(`${origins.lms}/`)
  ) {
    const url = new URL(value);
    if (
      url.origin === origins.lms &&
      !url.search &&
      !url.hash &&
      lmsInternalPath(url.pathname) &&
      value === lmsHref(url.pathname, origins)
    )
      return value;
  }
  return typeof value === 'string' &&
    (destinations.has(value) ||
      /^\/learn\/certificates\/[a-zA-Z0-9_-]{1,100}$/.test(value) ||
      /^\/learn\/courses\/[a-zA-Z0-9_-]{1,100}(?:\/(?:lessons|activities|assignments)\/[a-zA-Z0-9_-]{1,100})?$/.test(
        value,
      ))
    ? value.startsWith('/learn')
      ? lmsHref(value, origins)
      : value
    : '/dashboard';
}
