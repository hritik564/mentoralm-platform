import Link from 'next/link';
import { headers } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isAuthConfigured } from '@/lib/auth/config';
import { lmsAuthPath, lmsAuthReturn, lmsReturn } from '@/lib/auth/lms-entry';
import { lmsHref } from '@/lib/platform/domains';
import { getLmsRepository } from '@/lib/lms/services';
import { StudentError } from '@/lib/student/errors';
import { LmsAccessUnavailable } from './LmsAccessUnavailable';
import { LmsAuthForm } from './LmsAuthForm';
export async function LmsAuthEntry({
  mode,
  searchParams,
}: {
  mode: 'sign-in' | 'sign-up';
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { internal, rejected } = lmsReturn(params.redirect_url);
  const host = (await headers()).get('host') || 'localhost';
  const path = lmsAuthPath(mode, host),
    afterAuth = lmsAuthReturn('sign-in', internal, host);
  if (isAuthConfigured()) {
    try {
      if ((await auth()).userId) {
        await getLmsRepository();
        redirect(lmsHref(internal));
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'digest' in error) throw error;
      if (error instanceof StudentError && error.code === 'FORBIDDEN')
        return <LmsAccessUnavailable />;
      console.error('lms_entry_temporarily_unavailable');
      return <LmsAccessUnavailable retryUrl={afterAuth} />;
    }
  }
  return (
    <>
      <h2>
        {mode === 'sign-in' ? 'Welcome back.' : 'Start your learning journey.'}
      </h2>
      <p className="lms-muted">
        {mode === 'sign-in'
          ? 'Your existing Mentora account works here.'
          : 'Create one account for Mentora. Learning access is enabled separately.'}
      </p>
      {rejected && (
        <p className="lms-auth-notice" role="status">
          We’ll continue at your learning home after sign-in.
        </p>
      )}
      <LmsAuthForm
        mode={mode}
        path={path}
        afterAuth={afterAuth}
        switchUrl={lmsAuthReturn(
          mode === 'sign-in' ? 'sign-up' : 'sign-in',
          internal,
          host,
        )}
      />
      <p className="lms-auth-switch">
        {mode === 'sign-in' ? 'New to Mentora?' : 'Already have an account?'}{' '}
        <Link
          href={lmsAuthReturn(
            mode === 'sign-in' ? 'sign-up' : 'sign-in',
            internal,
            host,
          )}
        >
          {mode === 'sign-in' ? 'Create account' : 'Sign in'}
        </Link>
      </p>
    </>
  );
}
