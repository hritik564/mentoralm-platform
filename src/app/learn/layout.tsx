import { cookies, headers } from 'next/headers';
import { DashboardTheme } from '@/components/dashboard/theme/DashboardTheme';
import { productThemeCookie, resolveProductTheme } from '@/lib/dashboard/theme';
import type { Metadata } from 'next';
import { requireStudentIdentity } from '@/lib/auth/session';
import { LmsShell } from '@/components/lms/LmsShell';
import '@/styles/lms.css';
import '@/styles/lms-reset.css';
import '@/styles/lms-theme.css';
import '@/styles/lms-account.css';
import '@/styles/lms-auth.css';
import { LmsAuthFrame } from '@/components/lms/LmsAuthFrame';
import { LmsAccessUnavailable } from '@/components/lms/LmsAccessUnavailable';
import { lmsAuthReturn } from '@/lib/auth/lms-entry';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { getLmsRepository } from '@/lib/lms/services';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'MentoraLM Learning',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default async function LmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = resolveProductTheme(
    (await cookies()).get(productThemeCookie)?.value,
    undefined,
    'dark',
  );
  const entry = lmsAuthReturn(
    'sign-in',
    '/learn',
    (await headers()).get('host') || 'localhost',
  );
  let identity;
  try {
    identity = await requireStudentIdentity(entry);
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error('lms_identity_temporarily_unavailable');
    return (
      <DashboardTheme initialTheme={theme}>
        <LmsAuthFrame>
          <LmsAccessUnavailable retryUrl={entry} />
        </LmsAuthFrame>
      </DashboardTheme>
    );
  }
  return (
    <DashboardTheme initialTheme={theme}>
      <LmsShell user={identity}>
        <LmsBoundary
          load={async () => {
            await getLmsRepository();
            return children;
          }}
        />
      </LmsShell>
    </DashboardTheme>
  );
}
