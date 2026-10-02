import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { isAuthConfigured } from '@/lib/auth/config';
import { requireAdminActor } from '@/lib/admin/session';
import {
  adminSignInPath,
  adminDestination,
  adminHref,
} from '@/lib/platform/domains';
import { StudentError } from '@/lib/student/errors';
import { AdminUnavailable } from '@/components/admin/AdminShell';
import { AdminSignIn } from '@/components/admin/AdminSignIn';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    path = adminSignInPath((await headers()).get('host') || 'localhost'),
    destination = adminDestination(params.redirect_url);
  if (isAuthConfigured())
    try {
      if ((await auth()).userId) {
        await requireAdminActor();
        redirect(adminHref(destination));
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'digest' in error) throw error;
      return (
        <AdminUnavailable
          retry={!(error instanceof StudentError && error.code === 'FORBIDDEN')}
        />
      );
    }
  return (
    <>
      <p className="admin-eyebrow">Admin Console</p>
      <h1>Welcome back.</h1>
      <p>
        Use your existing Mentora account. Admin access is enabled separately.
      </p>
      <AdminSignIn
        path={path}
        destination={`${path}?redirect_url=${encodeURIComponent(destination)}`}
      />
    </>
  );
}
