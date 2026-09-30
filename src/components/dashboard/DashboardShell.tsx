'use client';

import Link from 'next/link';

import { useEffect, useRef, useState } from 'react';
import { UserAvatar, type AccountIdentity } from '@/components/auth/UserAvatar';
import { Brand } from '@/components/layout/Brand';
import { Icon } from '@/components/ui/Icon';
import { dashboardNavigation } from '@/content/dashboard';
import { DashboardNav } from './DashboardNav';

export function DashboardShell({
  user,
  pathname,
  onSignOut,
  children,
}: {
  user: AccountIdentity;
  pathname: string;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const title =
    dashboardNavigation.find((item) => item.href === pathname)?.label ||
    'Dashboard';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(min-width: 901px)');
    const resize = () => {
      if (media.matches) dialog.current?.close();
    };
    media.addEventListener('change', resize);
    return () => {
      document.body.style.overflow = overflow;
      media.removeEventListener('change', resize);
    };
  }, [open]);
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await onSignOut();
    } catch {
      setBusy(false);
      setError('Unable to log out. Please try again.');
    }
  }
  const account = (
    <div className="dashboard-user">
      <UserAvatar user={user} />
      <div>
        <strong>{user.name || 'Your account'}</strong>
        <span>{user.email}</span>
      </div>
      <button type="button" disabled={busy} onClick={logout}>
        {busy ? 'Logging out…' : 'Log out'}
      </button>
      {error && (
        <p role="alert" className="dashboard-logout-error">
          {error}
        </p>
      )}
    </div>
  );
  return (
    <div className="dashboard-shell">
      <a href="#dashboard-content" className="skip-link">
        Skip to dashboard content
      </a>
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <Brand href="/" />
          <span>Student workspace</span>
        </div>
        <DashboardNav pathname={pathname} />
        <Link className="dashboard-website-link" href="/">
          Visit public website <Icon name="arrow" />
        </Link>
        {account}
      </aside>
      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <button
            ref={trigger}
            type="button"
            className="icon-button dashboard-menu-trigger"
            aria-label="Open dashboard navigation"
            aria-controls="dashboard-mobile-navigation"
            aria-expanded={open}
            onClick={() => {
              setOpen(true);
              dialog.current?.showModal();
              close.current?.focus();
            }}
          >
            <Icon name="menu" />
          </button>
          <div>
            <span className="dashboard-breadcrumb">Your MentoraLM</span>
            <p>{title}</p>
          </div>
          <Link
            href="/dashboard/profile"
            className="dashboard-top-avatar"
            aria-label="Go to your profile"
          >
            <UserAvatar user={user} />
          </Link>
        </header>
        <main
          id="dashboard-content"
          className="dashboard-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
      <dialog
        ref={dialog}
        id="dashboard-mobile-navigation"
        className="dashboard-mobile-navigation"
        aria-labelledby="dashboard-menu-title"
        onClose={() => {
          setOpen(false);
          if (trigger.current?.getClientRects().length) trigger.current.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled])',
            ),
          ];
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="dashboard-mobile-inner">
          <div className="dashboard-mobile-heading">
            <h2 id="dashboard-menu-title">Your workspace</h2>
            <button
              ref={close}
              type="button"
              className="icon-button"
              aria-label="Close dashboard navigation"
              onClick={() => dialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="dashboard-brand">
            <Brand href="/" />
          </div>
          <DashboardNav
            pathname={pathname}
            onNavigate={() => dialog.current?.close()}
          />
          <Link className="dashboard-website-link" href="/">
            Visit public website <Icon name="arrow" />
          </Link>
          {account}
        </div>
      </dialog>
    </div>
  );
}
