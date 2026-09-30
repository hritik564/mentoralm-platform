'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;

export function MentiInteraction({ children }: { children: React.ReactNode }) {
  const button = useRef<HTMLButtonElement>(null);
  const blink = useRef<Animation | null>(null);
  const hydrated = useSyncExternalStore(
    subscribe,
    hydratedSnapshot,
    serverSnapshot,
  );

  useEffect(() => () => blink.current?.cancel(), []);

  function activate() {
    const eyes = button.current?.querySelector('.menti-eyes');
    if (!eyes) return;
    blink.current?.cancel();
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    // A deliberate, brief blink remains available when ambient motion is paused.
    const animation = eyes.animate(
      [
        { transform: 'scaleY(1)', offset: 0 },
        { transform: 'scaleY(0.06)', offset: 0.4 },
        { transform: 'scaleY(0.06)', offset: 0.6 },
        { transform: 'scaleY(1)', offset: 1 },
      ],
      { duration: reduced ? 120 : 280, easing: 'ease-in-out' },
    );
    animation.id = 'menti-activation-blink';
    blink.current = animation;
    animation.onfinish = () => {
      animation.cancel();
      if (blink.current === animation) blink.current = null;
    };
  }

  return (
    <button
      ref={button}
      type="button"
      className="menti-interaction"
      aria-label="Make Menti blink"
      disabled={!hydrated}
      onClick={activate}
    >
      {children}
    </button>
  );
}
