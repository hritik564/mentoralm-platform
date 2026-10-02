'use client';
import { SignIn, SignUp } from '@clerk/nextjs';
import { useAuthAvailable } from '../auth/AuthProvider';
import { useDashboardTheme } from '../dashboard/theme/DashboardTheme';
export function LmsAuthForm({
  mode,
  path,
  afterAuth,
  switchUrl,
}: {
  mode: 'sign-in' | 'sign-up';
  path: string;
  afterAuth: string;
  switchUrl: string;
}) {
  const available = useAuthAvailable();
  const { theme } = useDashboardTheme();
  if (!available)
    return (
      <p role="status">
        Secure sign-in is temporarily unavailable. Please try again later.
      </p>
    );
  const appearance = {
    variables: {
      colorPrimary: theme === 'dark' ? '#b49af5' : '#6333b8',
      colorPrimaryForeground: theme === 'dark' ? '#18243e' : '#ffffff',
      colorBackground: theme === 'dark' ? '#0d1829' : '#ffffff',
      colorForeground: theme === 'dark' ? '#f1f3ff' : '#18243e',
      colorMutedForeground: theme === 'dark' ? '#b3c0da' : '#526079',
      colorInputBackground: theme === 'dark' ? '#101c30' : '#ffffff',
      colorInputForeground: theme === 'dark' ? '#f1f3ff' : '#18243e',
      colorNeutral: theme === 'dark' ? '#c5cee0' : '#18243e',
    },
    elements: {
      rootBox: 'lms-clerk-root',
      cardBox: 'lms-clerk-box',
      card: 'lms-clerk-card',
    },
  };
  const fallback = <p role="status">Loading secure account form…</p>;
  return mode === 'sign-in' ? (
    <SignIn
      routing="path"
      path={path}
      appearance={appearance}
      fallback={fallback}
      forceRedirectUrl={afterAuth}
      signUpForceRedirectUrl={afterAuth}
      signUpUrl={switchUrl}
      withSignUp={false}
    />
  ) : (
    <SignUp
      routing="path"
      path={path}
      appearance={appearance}
      fallback={fallback}
      forceRedirectUrl={afterAuth}
      signInForceRedirectUrl={afterAuth}
      signInUrl={switchUrl}
    />
  );
}
