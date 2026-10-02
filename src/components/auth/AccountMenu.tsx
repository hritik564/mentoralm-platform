'use client';

import Link from 'next/link';

import { useEffect, useId, useRef, useState } from 'react';
import { UserAvatar, type AccountIdentity } from './UserAvatar';

export function AccountMenu({
  user,
  onSignOut,
  links = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Support', href: '/dashboard/support' },
  ],
  className = '',
}: {
  user: AccountIdentity;
  onSignOut: () => Promise<void>;
  links?: readonly { label: string; href: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    // Touch activation may leave focus outside the disclosure. Move it inside so
    // Escape closes this account panel before the enclosing mobile navigation.
    panel.current?.querySelector<HTMLElement>('a')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        root.current?.contains(document.activeElement)
      ) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <div
      ref={root}
      className={`account-menu ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        const controls = [
          ...(panel.current?.querySelectorAll<HTMLElement>(
            'a, button:not([disabled])',
          ) ?? []),
        ];
        if (
          !controls.length ||
          !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
        )
          return;
        event.preventDefault();
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? controls.length - 1
              : (index +
                  (event.key === 'ArrowDown' ? 1 : -1) +
                  controls.length) %
                controls.length;
        controls[next]?.focus();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="account-trigger"
        aria-label={`Open account menu for ${user.name || user.email || 'your account'}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <UserAvatar user={user} />
      </button>
      <div ref={panel} id={id} className="account-panel" hidden={!open}>
        <div className="account-identity">
          <UserAvatar user={user} />
          <div>
            <strong>{user.name || 'Your account'}</strong>
            <span>{user.email}</span>
          </div>
        </div>
        <nav aria-label="Account navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              prefetch={false}
              href={link.href}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await onSignOut();
              } catch {
                setError('Unable to log out. Please try again.');
                setBusy(false);
              }
            }}
          >
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </nav>
        {error && (
          <p role="alert" className="account-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
