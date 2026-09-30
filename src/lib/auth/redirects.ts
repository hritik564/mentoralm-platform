const destinations = new Set([
  '/dashboard',
  '/dashboard/courses',
  '/dashboard/resources',
  '/dashboard/support',
  '/dashboard/referral',
  '/dashboard/profile',
]);

/** Exact internal routes only; never follow arbitrary provider/query redirects. */
export function dashboardDestination(value: unknown): string {
  return typeof value === 'string' && destinations.has(value)
    ? value
    : '/dashboard';
}
