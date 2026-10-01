import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { isAuthConfigured } from '@/lib/auth/config';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'MentoraLM invitation',
  robots: { index: false, follow: false },
};
export default async function Invitation({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const signedIn = isAuthConfigured() && Boolean((await auth()).userId);
  // Attribution requires an authenticated confirmation inside Dashboard, never a GET mutation.
  const destination = /^[a-zA-Z0-9_-]{20,64}$/.test(code)
    ? `/dashboard/referral?invite=${encodeURIComponent(code)}`
    : '/dashboard/referral';
  return (
    <main style={{ padding: '64px 24px', maxWidth: 640, margin: 'auto' }}>
      <h1>You&apos;re invited to MentoraLM</h1>
      <p>
        Sign in or create your account, then return to this invitation to
        confirm it.
      </p>
      <Link href={signedIn ? destination : '/sign-in'}>
        {signedIn ? 'Review invitation' : 'Sign in / Create account'}
      </Link>
    </main>
  );
}
