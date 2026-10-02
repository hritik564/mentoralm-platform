import { cookies } from 'next/headers';
import { DashboardTheme } from '@/components/dashboard/theme/DashboardTheme';
import {
  dashboardThemeCookie,
  productThemeCookie,
  resolveProductTheme,
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
  const preferences = await cookies();
  const theme = resolveProductTheme(
    preferences.get(productThemeCookie)?.value,
    preferences.get(dashboardThemeCookie)?.value,
    'light',
  );
  return (
    <DashboardTheme
      initialTheme={theme}
      migratePreference={
        !preferences.get(productThemeCookie) &&
        !!preferences.get(dashboardThemeCookie)
      }
    >
      <DashboardSession user={user}>{children}</DashboardSession>
    </DashboardTheme>
  );
}
