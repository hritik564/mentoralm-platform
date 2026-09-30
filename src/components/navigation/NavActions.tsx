import type { ReactNode } from 'react';
import { notices } from '@/content/home';
import { NoticeButton } from '@/components/ui/NoticeButton';

export function NavActions({ accountActions }: { accountActions?: ReactNode }) {
  return (
    accountActions ?? (
      <NoticeButton {...notices.login} className="nav-login glow-action" arrow>
        Login / Sign up
      </NoticeButton>
    )
  );
}
