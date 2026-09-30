'use client';

import { SignIn, SignUp } from '@clerk/nextjs';
import { useAuthAvailable } from './AuthProvider';

export function AuthForm({
  mode,
  destination = '/dashboard',
  sheet = false,
}: {
  mode: 'sign-in' | 'sign-up';
  destination?: string;
  sheet?: boolean;
}) {
  const available = useAuthAvailable();
  if (!available)
    return (
      <div className="auth-unavailable" role="status">
        <span className="auth-status-dot" aria-hidden="true" />
        <h3>Sign-in is not available yet</h3>
        <p>
          We’re setting up secure MentoraLM accounts. Please return when sign-in
          is ready.
        </p>
        <p className="auth-caption">
          No account or password can be submitted here yet.
        </p>
      </div>
    );
  const routing = sheet
    ? { routing: 'hash' as const }
    : {
        routing: 'path' as const,
        path: mode === 'sign-in' ? '/sign-in' : '/sign-up',
      };
  const fallback = (
    <p role="status" className="auth-loading">
      Loading secure account form…
    </p>
  );
  const appearance = {
    elements: {
      rootBox: 'auth-clerk-root',
      cardBox: 'auth-clerk-box',
      card: 'auth-clerk-card',
      footerAction: sheet ? 'auth-clerk-switch-hidden' : '',
    },
  };
  return mode === 'sign-in' ? (
    <SignIn
      {...routing}
      appearance={appearance}
      fallback={fallback}
      forceRedirectUrl={destination}
      signUpForceRedirectUrl={destination}
      signUpUrl="/sign-up"
      withSignUp={false}
    />
  ) : (
    <SignUp
      {...routing}
      appearance={appearance}
      fallback={fallback}
      forceRedirectUrl={destination}
      signInForceRedirectUrl={destination}
      signInUrl="/sign-in"
    />
  );
}
