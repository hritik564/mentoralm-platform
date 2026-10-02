export type DashboardTheme = 'light' | 'dark';
export const dashboardThemeCookie = 'mentoralm-dashboard-theme';
export function parseDashboardTheme(value: string | undefined): DashboardTheme {
  return value === 'dark' ? 'dark' : 'light';
}

// Shared device preference for authenticated product surfaces only.
export const productThemeCookie = 'mentoralm-product-theme';
export function resolveProductTheme(
  saved: string | undefined,
  legacy: string | undefined,
  fallback: DashboardTheme,
): DashboardTheme {
  if (saved === 'light' || saved === 'dark') return saved;
  if (legacy === 'light' || legacy === 'dark') return legacy;
  return fallback;
}
export function productThemeCookieAttributes(
  hostname: string,
  protocol: string,
) {
  const approved =
    protocol === 'https:' &&
    ['mentoralm.com', 'students.mentoralm.com', 'admin.mentoralm.com'].includes(
      hostname,
    );
  return `Path=/; Max-Age=31536000; SameSite=Lax${protocol === 'https:' ? '; Secure' : ''}${approved ? '; Domain=mentoralm.com' : ''}`;
}
