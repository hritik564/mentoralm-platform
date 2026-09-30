'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { mentiGazeToward } from '@/components/menti/gaze';
import { ModuleCarousel } from './ModuleCarousel';

const mobileQuery = '(max-width: 1100px)';
const reducedQuery = '(prefers-reduced-motion: reduce)';
const serverSnapshot = () => false;
const clientSnapshot = () => true;
const subscribeHydration = () => () => {};
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const reducedSnapshot = () => window.matchMedia(reducedQuery).matches;
function subscribeQuery(query: string, notify: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}
const subscribeMobile = (notify: () => void) =>
  subscribeQuery(mobileQuery, notify);
const subscribeReduced = (notify: () => void) =>
  subscribeQuery(reducedQuery, notify);

/** Transient discovery state only; cards and the exact shared Menti arrive as server children. */
export function ModuleExperience({
  children,
  count,
}: {
  children: React.ReactNode;
  count: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [current, setCurrent] = useState(1);
  const [paused, setPaused] = useState(false);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    serverSnapshot,
  );
  const reduced = useSyncExternalStore(
    subscribeReduced,
    reducedSnapshot,
    serverSnapshot,
  );
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientSnapshot,
    serverSnapshot,
  );

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const track = element.querySelector<HTMLOListElement>('.module-discovery')!;
    const character = element.querySelector<HTMLElement>('.menti-character')!;
    const slots = [...track.querySelectorAll<HTMLElement>('.module-slot')];
    let hovered: HTMLElement | null = null;
    let frame = 0;
    let disposed = false;
    const slotFor = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>('.module-slot')
        : null;
    const available = (slot: HTMLElement | null) =>
      slot?.querySelector('[data-module-status="featured"]') ? slot : null;
    const primary = () => {
      const bounds = track.getBoundingClientRect();
      return slots.reduce((best, slot) => {
        const visible = (candidate: HTMLElement) => {
          const rect = candidate.getBoundingClientRect();
          return (
            Math.max(
              0,
              Math.min(rect.right, bounds.right) -
                Math.max(rect.left, bounds.left),
            ) / rect.width
          );
        };
        return visible(slot) > visible(best) + 0.01 ? slot : best;
      }, slots[0]);
    };
    const target = (slot: HTMLElement | null) => {
      if (disposed) return;
      setActive(slot ? Number(slot.dataset.modulePosition) : null);
      let gaze = { x: 0, y: 0 };
      if (slot && !reduced && !paused) {
        const source = character.getBoundingClientRect();
        const destination = slot.getBoundingClientRect();
        gaze = mentiGazeToward(
          {
            x: source.left + source.width / 2,
            y: source.top + source.height / 2,
          },
          {
            x: destination.left + destination.width / 2,
            y: destination.top + destination.height / 2,
          },
        );
      }
      element.style.setProperty('--menti-gaze-x', `${gaze.x.toFixed(2)}px`);
      element.style.setProperty('--menti-gaze-y', `${gaze.y.toFixed(2)}px`);
    };
    const retarget = () => {
      const focused = available(slotFor(document.activeElement));
      target(focused ?? hovered ?? (mobile ? primary() : null));
    };
    const over = (event: PointerEvent) => {
      if (
        mobile ||
        event.pointerType !== 'mouse' ||
        !window.matchMedia('(hover: hover)').matches
      )
        return;
      hovered = available(slotFor(event.target));
      retarget();
    };
    const out = (event: PointerEvent) => {
      if (
        event.relatedTarget instanceof Node &&
        hovered?.contains(event.relatedTarget)
      )
        return;
      hovered = null;
      retarget();
    };
    const focus = (event: FocusEvent) => {
      const slot = available(slotFor(event.target));
      if (mobile && slot) {
        track.scrollTo({
          left:
            track.scrollLeft +
            slot.getBoundingClientRect().left -
            track.getBoundingClientRect().left,
          behavior: 'instant',
        });
      }
      retarget();
    };
    const blur = () => queueMicrotask(retarget);
    const tap = (event: PointerEvent) => {
      if (!mobile) return;
      const slot = slotFor(event.target);
      if (slot) {
        setCurrent(Number(slot.dataset.modulePosition));
        target(slot);
      }
    };
    const scroll = () => {
      if (!mobile || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const slot = primary();
        setCurrent(Number(slot.dataset.modulePosition));
        target(slot);
      });
    };
    const resize = new ResizeObserver(() => {
      retarget();
      if (mobile) setCurrent(Number(primary().dataset.modulePosition));
    });
    resize.observe(track);
    resize.observe(character);
    element.addEventListener('pointerover', over);
    element.addEventListener('pointerout', out);
    element.addEventListener('pointerdown', tap);
    element.addEventListener('focusin', focus);
    element.addEventListener('focusout', blur);
    track.addEventListener('scroll', scroll, { passive: true });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      element.removeEventListener('pointerover', over);
      element.removeEventListener('pointerout', out);
      element.removeEventListener('pointerdown', tap);
      element.removeEventListener('focusin', focus);
      element.removeEventListener('focusout', blur);
      track.removeEventListener('scroll', scroll);
      element.style.setProperty('--menti-gaze-x', '0px');
      element.style.setProperty('--menti-gaze-y', '0px');
    };
  }, [mobile, paused, reduced]);

  function move(direction: number) {
    const next = Math.max(1, Math.min(count, current + direction));
    const track =
      root.current?.querySelector<HTMLOListElement>('.module-discovery');
    const slot = track?.querySelector<HTMLElement>(
      `[data-module-position="${next}"]`,
    );
    if (!track || !slot) return;
    track.scrollTo({
      left:
        track.scrollLeft +
        slot.getBoundingClientRect().left -
        track.getBoundingClientRect().left,
      behavior: reduced ? 'instant' : 'smooth',
    });
  }

  return (
    <div
      className="module-experience"
      ref={root}
      data-enhanced={hydrated}
      data-active-position={active ?? ''}
      data-motion-paused={paused}
    >
      {children}
      <div className="module-controls">
        <ModuleCarousel current={current} count={count} onMove={move} />
        <button
          type="button"
          className="module-motion-control"
          hidden={reduced}
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? 'Resume Menti motion' : 'Pause Menti motion'}
        </button>
      </div>
    </div>
  );
}
