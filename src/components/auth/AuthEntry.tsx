import Link from 'next/link';
import { Brand } from '@/components/layout/Brand';
import { AuthForm } from './AuthForm';

export function AuthEntry({
  mode,
  destination,
}: {
  mode: 'sign-in' | 'sign-up';
  destination: string;
}) {
  return (
    <main className="auth-entry">
      <section className="auth-entry-story" aria-label="MentoraLM account">
        <Brand href="/" />
        <div>
          <p className="auth-eyebrow">One MentoraLM account</p>
          <h1>
            Your future,
            <br />
            <em>connected.</em>
          </h1>
          <p>A clear space for your learning, discovery and next chapter.</p>
        </div>
        <Link href="/">← Back to MentoraLM</Link>
      </section>
      <section className="auth-entry-form" aria-labelledby="auth-entry-title">
        <Link className="auth-mobile-back" href="/">
          ← Back to MentoraLM
        </Link>
        <p className="auth-eyebrow">Your next chapter</p>
        <h2 id="auth-entry-title">
          {mode === 'sign-in' ? 'Welcome back.' : 'Let’s get started.'}
        </h2>
        <p className="auth-intro">
          {mode === 'sign-in'
            ? 'Login to your MentoraLM account.'
            : 'Create your MentoraLM account.'}
        </p>
        <AuthForm mode={mode} destination={destination} />
        <p className="auth-entry-switch">
          {mode === 'sign-in'
            ? 'New to MentoraLM?'
            : 'Already have an account?'}{' '}
          <Link
            href={`${mode === 'sign-in' ? '/sign-up' : '/sign-in'}?redirect_url=${encodeURIComponent(destination)}`}
          >
            {mode === 'sign-in' ? 'Create Account' : 'Login'}
          </Link>
        </p>
      </section>
    </main>
  );
}
