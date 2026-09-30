import type { ReactNode } from 'react';
import { WebsiteAccount } from '@/components/auth/WebsiteAccount';

export function NavActions({ accountActions }: { accountActions?: ReactNode }) {
  return accountActions ?? <WebsiteAccount />;
}
