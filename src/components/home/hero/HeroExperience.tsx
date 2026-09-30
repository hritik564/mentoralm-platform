'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

const readReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotion = () => false;
function subscribeMotion(notify: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}

/** One small interaction island; editorial children remain server-rendered. */
export function HeroExperience({ children }: { children: ReactNode }) {
  const hero = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    readReducedMotion,
    serverMotion,
  );
  useEffect(() => {
    const element = hero.current;
    if (!element) return;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    let lastUpdate = 0;
    let bounds = element.getBoundingClientRect();
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      element.style.setProperty('--menti-gaze-x', '0px');
      element.style.setProperty('--menti-gaze-y', '0px');
    };
    const measure = () => {
      bounds = element.getBoundingClientRect();
    };
    const track = (event: PointerEvent) => {
      if (
        paused ||
        reduced ||
        !finePointer.matches ||
        event.pointerType !== 'mouse'
      )
        return;
      // At most ~12 updates/second, with a single pending animation frame.
      if (frame || performance.now() - lastUpdate < 80) return;
      lastUpdate = performance.now();
      frame = requestAnimationFrame(() => {
        frame = 0;
        const x = Math.max(
          -1,
          Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
        );
        const y = Math.max(
          -1,
          Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
        );
        element.style.setProperty(
          '--menti-gaze-x',
          `${(x * 2.4).toFixed(2)}px`,
        );
        element.style.setProperty(
          '--menti-gaze-y',
          `${(y * 1.8).toFixed(2)}px`,
        );
      });
    };
    element.addEventListener('pointerenter', measure);
    element.addEventListener('pointermove', track, { passive: true });
    element.addEventListener('pointerleave', reset);
    finePointer.addEventListener('change', reset);
    return () => {
      reset();
      element.removeEventListener('pointerenter', measure);
      element.removeEventListener('pointermove', track);
      element.removeEventListener('pointerleave', reset);
      finePointer.removeEventListener('change', reset);
    };
  }, [paused, reduced]);
  return (
    <section
      ref={hero}
      className="hero hero--cinematic"
      aria-labelledby="hero-heading"
      data-motion-paused={paused}
    >
      {children}
      <div className="container hero-scene-footer">
        <span>Ecosystem vision · capabilities in development</span>
        <button
          type="button"
          className="hero-motion-control"
          aria-pressed={paused}
          hidden={reduced}
          onClick={() => setPaused(!paused)}
        >
          {paused ? 'Resume motion' : 'Pause motion'}
        </button>
      </div>
    </section>
  );
}
