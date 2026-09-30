'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { mentiGazeToward } from '@/components/menti/gaze';

const query = '(prefers-reduced-motion: reduce)';
const serverSnapshot = () => false;
const hydratedSnapshot = () => true;
const subscribeHydration = () => () => {};
const reducedSnapshot = () => window.matchMedia(query).matches;
function subscribeReduced(notify: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}
const stageFor = (target: EventTarget | null) =>
  target instanceof Element
    ? (target.closest<HTMLElement>('[data-stage]')?.dataset.stage ?? null)
    : null;

/** Section-local emphasis only: no saved progress, onboarding or assistant session. */
export function JourneyExperience({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    hydratedSnapshot,
    serverSnapshot,
  );
  const reduced = useSyncExternalStore(
    subscribeReduced,
    reducedSnapshot,
    serverSnapshot,
  );
  const active = focused ?? hovered ?? selected;

  useEffect(() => {
    const section = root.current?.closest<HTMLElement>('#journey');
    if (!section) return;
    let frame = 0;
    let cancelled = false;
    let generation = 0;
    const cancel = () => {
      cancelled = true;
      generation++;
      cancelAnimationFrame(frame);
    };
    const alignFragment = async () => {
      if (location.hash !== '#journey') return;
      cancelled = false;
      const request = ++generation;
      await document.fonts.ready;
      if (cancelled || request !== generation) return;
      // Native initial fragment scrolling can use the taller pre-hydration layout.
      // Two paint frames allow preceding responsive sections to settle first.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (
            !cancelled &&
            request === generation &&
            location.hash === '#journey'
          ) {
            section.scrollIntoView({ block: 'start', behavior: 'instant' });
          }
        });
      });
    };
    void alignFragment();
    window.addEventListener('hashchange', alignFragment);
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('pointerdown', cancel, { passive: true });
    window.addEventListener('keydown', cancel);
    return () => {
      cancel();
      window.removeEventListener('hashchange', alignFragment);
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('pointerdown', cancel);
      window.removeEventListener('keydown', cancel);
    };
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const buttons = element.querySelectorAll<HTMLButtonElement>(
      '[data-stage-button]',
    );
    buttons.forEach((button) => {
      button.disabled = !hydrated;
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.stageButton === selected),
      );
    });
    const position = Number(active ?? 0);
    element
      .querySelectorAll<SVGGElement>('[data-route-stage]')
      .forEach((segment) => {
        segment.dataset.reached = String(
          Number(segment.dataset.routeStage) <= position,
        );
      });
    element.querySelectorAll<HTMLElement>('[data-stage]').forEach((stage) => {
      const number = Number(stage.dataset.stage);
      stage.dataset.reached = String(number <= position);
      stage.dataset.pathReached = String(number < position);
    });
    const milestone = active
      ? element.querySelector<HTMLElement>(`[data-stage="${active}"]`)
      : null;
    element.style.setProperty(
      '--journey-active-color',
      milestone
        ? getComputedStyle(milestone).getPropertyValue('--stage-color')
        : '#c5c5e4',
    );
    const update = () => {
      const source = element
        .querySelector('.menti-character')!
        .getBoundingClientRect();
      const target = active
        ? element
            .querySelector(`[data-stage="${active}"] .roadmap-card`)
            ?.getBoundingClientRect()
        : null;
      const gaze =
        target && !reduced && !paused
          ? mentiGazeToward(
              {
                x: source.left + source.width / 2,
                y: source.top + source.height / 2,
              },
              {
                x: target.left + target.width / 2,
                y: target.top + target.height / 2,
              },
            )
          : { x: 0, y: 0 };
      element.style.setProperty('--menti-gaze-x', `${gaze.x.toFixed(2)}px`);
      element.style.setProperty('--menti-gaze-y', `${gaze.y.toFixed(2)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.style.removeProperty('--menti-gaze-x');
      element.style.removeProperty('--menti-gaze-y');
    };
  }, [active, hydrated, paused, reduced, selected]);

  return (
    <div
      ref={root}
      className="roadmap-experience"
      data-enhanced={hydrated}
      data-active-stage={active ?? ''}
      data-motion-paused={paused || reduced}
      onPointerOver={(event) => {
        if (
          event.pointerType === 'mouse' &&
          window.matchMedia('(hover: hover)').matches
        )
          setHovered(stageFor(event.target));
      }}
      onPointerLeave={() => setHovered(null)}
      onFocus={(event) => setFocused(stageFor(event.target))}
      onBlur={(event) => setFocused(stageFor(event.relatedTarget))}
      onClick={(event) => {
        const stage = stageFor(event.target);
        if (stage) setSelected((value) => (value === stage ? null : stage));
      }}
    >
      {children}
      <div className="roadmap-controls">
        <p>Choose a milestone to bring it into focus.</p>
        <button
          type="button"
          hidden={!hydrated || reduced}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? 'Resume journey motion' : 'Pause journey motion'}
        </button>
      </div>
    </div>
  );
}
