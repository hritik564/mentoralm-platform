export type DashboardTheme = 'light' | 'dark';
export const dashboardThemeCookie = 'mentoralm-dashboard-theme';
export function parseDashboardTheme(value: string | undefined): DashboardTheme {
  return value === 'dark' ? 'dark' : 'light';
}
