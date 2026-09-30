import { cookies } from 'next/headers';
import { DashboardTheme } from '@/components/dashboard/theme/DashboardTheme';
import {
  dashboardThemeCookie,
  parseDashboardTheme,
} from '@/lib/dashboard/theme';
import '@/styles/dashboard-theme.css';
import '@/styles/dashboard-features.css';
import type { Metadata } from 'next';
import { requireStudentIdentity } from '@/lib/auth/session';
import { DashboardSession } from '@/components/dashboard/DashboardSession';
import '@/styles/dashboard.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Student Dashboard',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStudentIdentity();
  const theme = parseDashboardTheme(
    (await cookies()).get(dashboardThemeCookie)?.value,
  );
  return (
    <DashboardTheme initialTheme={theme}>
      <DashboardSession user={user}>{children}</DashboardSession>
    </DashboardTheme>
  );
}
