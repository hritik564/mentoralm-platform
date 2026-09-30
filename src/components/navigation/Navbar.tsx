'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { navigation } from '@/content/home';
import { Brand } from '@/components/layout/Brand';
import { Icon } from '@/components/ui/Icon';
import { GlassSurface, type GlassTone } from '@/components/ui/GlassSurface';
import { DesktopNav } from './DesktopNav';
import { MobileNav } from './MobileNav';
import { NavActions } from './NavActions';

function subscribeScroll(notify: () => void) {
  window.addEventListener('scroll', notify, { passive: true });
  return () => window.removeEventListener('scroll', notify);
}
const getScrollState = () => window.scrollY > 24;
const getServerScrollState = () => false;

// Explicit appearance prop prepares context adaptation without section tracking.
// Account actions are a presentation slot, with no authentication logic.
export function Navbar({
  accountActions,
  tone = 'dark',
}: {
  accountActions?: ReactNode;
  tone?: GlassTone;
}) {
  const [open, setOpen] = useState(false);
  const scrolled = useSyncExternalStore(
    subscribeScroll,
    getScrollState,
    getServerScrollState,
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const closeMenu = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = Array.from(
      document.querySelectorAll<HTMLElement>('main, footer'),
    );
    const previousInert = background.map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    const onKey = (event: KeyboardEvent) => {
      // Native availability dialogs manage their own focus and Escape first.
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        header.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ) ?? [],
      ).filter(
        (element) =>
          element.getClientRects().length > 0 && !element.closest('dialog'),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const media = window.matchMedia('(min-width: 960px)');
    const onResize = () => {
      if (media.matches) {
        const focusInMenu = header.current?.contains(document.activeElement);
        setOpen(false);
        if (focusInMenu)
          header.current?.querySelector<HTMLElement>('.brand')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    media.addEventListener('change', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((element, index) => {
        element.inert = previousInert[index];
      });
      document.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onResize);
    };
  }, [open]);

  return (
    <header
      className="site-header"
      ref={header}
      data-tone={tone}
      data-scrolled={scrolled}
      data-menu-open={open}
    >
      <GlassSurface tone={tone} className="container nav-bar">
        <Brand />
        <DesktopNav />
        <div className="nav-actions">
          <NavActions accountActions={accountActions} />
        </div>
        <button
          className="icon-button menu-trigger"
          ref={trigger}
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
        <MobileNav
          open={open}
          onClose={closeMenu}
          accountActions={accountActions}
        />
      </GlassSurface>
      {open && (
        <div
          className="navigation-backdrop"
          aria-hidden="true"
          onClick={closeMenu}
        />
      )}
      <noscript>
        <nav
          className="no-js-navigation container"
          aria-label="Navigation without JavaScript"
        >
          {navigation.map((item) => (
            <a key={item.href} href={item.href}>
              {item.href === '#programs' ? 'Modules' : item.label}
            </a>
          ))}
        </nav>
      </noscript>
    </header>
  );
}
