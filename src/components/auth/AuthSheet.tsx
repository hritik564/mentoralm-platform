'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Brand } from '@/components/layout/Brand';
import { Icon } from '@/components/ui/Icon';
import { AuthForm } from './AuthForm';

export function AuthSheet() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="nav-login glow-action"
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => {
          setMode('sign-in');
          setOpen(true);
          dialog.current?.showModal();
          close.current?.focus();
        }}
      >
        Login / Sign up <Icon name="arrow" />
      </button>
      <dialog
        ref={dialog}
        id={id}
        className="auth-sheet"
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
            ),
          ].filter((el) => el.getClientRects().length > 0);
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
        <div className="auth-sheet-content">
          <div className="auth-heading-row">
            <Brand />
            <button
              ref={close}
              className="icon-button"
              type="button"
              aria-label="Close authentication"
              onClick={() => dialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <p className="auth-eyebrow">Your next chapter</p>
          <h2 id={`${id}-title`}>
            One account.
            <br />A world of possibilities.
          </h2>
          <p className="auth-intro">Your MentoraLM journey starts here.</p>
          <div
            className="auth-mode-switch"
            role="group"
            aria-label="Account access"
          >
            <button
              type="button"
              aria-pressed={mode === 'sign-in'}
              onClick={() => setMode('sign-in')}
            >
              Login
            </button>
            <button
              type="button"
              aria-pressed={mode === 'sign-up'}
              onClick={() => setMode('sign-up')}
            >
              Create Account
            </button>
          </div>
          {open && <AuthForm key={mode} mode={mode} sheet />}
          <p className="auth-caption auth-assurance">
            Secure access to your MentoraLM account.
          </p>
        </div>
      </dialog>
    </>
  );
}
