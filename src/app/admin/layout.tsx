import { adminCapabilities } from '@/lib/auth/admin-policy';
import { getDatabase } from '@/lib/db/client';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAdminActor } from '@/lib/admin/session';
import { requireStudentIdentity } from '@/lib/auth/session';
import { adminSignInPath } from '@/lib/platform/domains';
import { StudentError } from '@/lib/student/errors';
import { DashboardTheme } from '@/components/dashboard/theme/DashboardTheme';
import { productThemeCookie, resolveProductTheme } from '@/lib/dashboard/theme';
import {
  AdminShell,
  AdminEntryFrame,
  AdminUnavailable,
} from '@/components/admin/AdminShell';
import '@/styles/admin.css';
import '@/styles/admin-academic.css';
import '@/styles/admin-operational.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Mentora Admin',
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
      'light',
    ),
    entry = adminSignInPath((await headers()).get('host') || 'localhost');
  let identity;
  let access;
  let failure: unknown;
  try {
    const actor = await requireAdminActor();
    access = await adminCapabilities(getDatabase(), actor.id);
    identity = await requireStudentIdentity(entry);
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    if (error instanceof StudentError && error.code === 'UNAUTHENTICATED')
      redirect(entry);
    failure = error;
  }
  return (
    <DashboardTheme initialTheme={theme}>
      {identity && access ? (
        <AdminShell user={identity} access={access}>
          {children}
        </AdminShell>
      ) : (
        <AdminEntryFrame>
          <AdminUnavailable
            retry={
              !(failure instanceof StudentError && failure.code === 'FORBIDDEN')
            }
          />
        </AdminEntryFrame>
      )}
    </DashboardTheme>
  );
}
