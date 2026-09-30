import { AuthEntry } from '@/components/auth/AuthEntry';
import { dashboardDestination } from '@/lib/auth/redirects';
import { isAuthConfigured } from '@/lib/auth/config';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Login',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const destination = dashboardDestination((await searchParams).redirect_url);
  if (isAuthConfigured() && (await auth()).userId) redirect(destination);
  return <AuthEntry mode="sign-in" destination={destination} />;
}
