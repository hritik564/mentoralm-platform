import { cookies } from 'next/headers';
import { DashboardTheme } from '@/components/dashboard/theme/DashboardTheme';
import { productThemeCookie, resolveProductTheme } from '@/lib/dashboard/theme';
import { LmsAuthFrame } from '@/components/lms/LmsAuthFrame';
import '@/styles/lms.css';
import '@/styles/lms-reset.css';
import '@/styles/lms-theme.css';
import '@/styles/lms-account.css';
import '@/styles/lms-auth.css';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Mentora student account',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = resolveProductTheme(
    (await cookies()).get(productThemeCookie)?.value,
    undefined,
    'dark',
  );
  return (
    <DashboardTheme initialTheme={theme}>
      <LmsAuthFrame>{children}</LmsAuthFrame>
    </DashboardTheme>
  );
}
