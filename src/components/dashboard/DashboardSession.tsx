'use client';

import { useClerk } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import type { AccountIdentity } from '@/components/auth/UserAvatar';
import { DashboardShell } from './DashboardShell';

/** Identity is supplied only by the protected server layout. */
export function DashboardSession({
  user,
  children,
}: {
  user: AccountIdentity;
  children: React.ReactNode;
}) {
  const { signOut } = useClerk();
  return (
    <DashboardShell
      user={user}
      pathname={usePathname()}
      onSignOut={async () => {
        await signOut({ redirectUrl: '/' });
      }}
    >
      {children}
    </DashboardShell>
  );
}
