import { cookies } from 'next/headers';
import { DashboardTheme } from '@/components/dashboard/theme/DashboardTheme';
import { productThemeCookie, resolveProductTheme } from '@/lib/dashboard/theme';
import { AdminEntryFrame } from '@/components/admin/AdminShell';
import '@/styles/admin.css';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Mentora Admin sign-in',
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = resolveProductTheme(
    (await cookies()).get(productThemeCookie)?.value,
    undefined,
    'light',
  );
  return (
    <DashboardTheme initialTheme={theme}>
      <AdminEntryFrame>{children}</AdminEntryFrame>
    </DashboardTheme>
  );
}
