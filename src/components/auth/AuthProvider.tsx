'use client';

import { createContext, useContext } from 'react';
import { ClerkProvider } from '@clerk/nextjs';

const Availability = createContext(false);
export const useAuthAvailable = () => useContext(Availability);

export function AuthProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const content = (
    <Availability.Provider value={enabled}>{children}</Availability.Provider>
  );
  return enabled ? (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      allowedRedirectOrigins={[]}
      appearance={{
        variables: {
          colorPrimary: '#6550b9',
          colorForeground: '#15213d',
          colorMutedForeground: '#53627b',
          fontFamily: 'var(--font-body)',
          borderRadius: '0.8rem',
        },
      }}
    >
      {content}
    </ClerkProvider>
  ) : (
    content
  );
}
