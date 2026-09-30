'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { useAuthAvailable } from './AuthProvider';
import { AuthSheet } from './AuthSheet';
import { AccountMenu } from './AccountMenu';

function ClerkAccount() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  if (!isLoaded)
    return (
      <button
        className="nav-login glow-action"
        disabled
        aria-label="Loading account"
      >
        Account…
      </button>
    );
  if (!isSignedIn || !user) return <AuthSheet />;
  return (
    <AccountMenu
      user={{
        name: user.fullName || user.username || '',
        firstName: user.firstName,
        email: user.primaryEmailAddress?.emailAddress || '',
        imageUrl: user.hasImage ? user.imageUrl : null,
      }}
      onSignOut={async () => {
        await signOut({ redirectUrl: '/' });
      }}
    />
  );
}

export function WebsiteAccount() {
  return useAuthAvailable() ? <ClerkAccount /> : <AuthSheet />;
}
