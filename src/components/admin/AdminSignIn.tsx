'use client';
import { SignIn } from '@clerk/nextjs';
import { useAuthAvailable } from '../auth/AuthProvider';
import { useDashboardTheme } from '../dashboard/theme/DashboardTheme';
export function AdminSignIn({
  path,
  destination,
}: {
  path: string;
  destination: string;
}) {
  const available = useAuthAvailable(),
    { theme } = useDashboardTheme();
  return available ? (
    <SignIn
      routing="path"
      path={path}
      forceRedirectUrl={destination}
      withSignUp={false}
      appearance={{
        variables: {
          colorBackground: theme === 'dark' ? '#151f32' : '#ffffff',
          colorForeground: theme === 'dark' ? '#edf2ff' : '#18243e',
          colorMutedForeground: theme === 'dark' ? '#b6c2d9' : '#526079',
          colorPrimary: theme === 'dark' ? '#b8a0ff' : '#6942d9',
          colorPrimaryForeground: theme === 'dark' ? '#18243e' : '#ffffff',
        },
        elements: {
          footerAction: { display: 'none' },
          rootBox: 'admin-clerk',
          cardBox: 'admin-clerk-box',
          card: 'admin-clerk-card',
        },
      }}
    />
  ) : (
    <p role="status">Secure sign-in is temporarily unavailable.</p>
  );
}
