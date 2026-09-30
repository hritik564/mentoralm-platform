'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { programs } from '@/content/programs';
import { Icon } from '@/components/ui/Icon';

export function ModulesDropdown({ mobile = false }: { mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      // Inline mobile content must not move sibling links during pointer clicks.
      if (
        mobile &&
        event.target instanceof Element &&
        event.target.closest('.mobile-navigation')
      )
        return;
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
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
    const media = window.matchMedia('(min-width: 960px)');
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey, true);
    media.addEventListener('change', onResize);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey, true);
      media.removeEventListener('change', onResize);
    };
  }, [open, mobile]);
  return (
    <div
      ref={root}
      className={`modules-discovery${mobile ? ' modules-discovery--mobile' : ''}`}
      onBlur={(event) => {
        if (!mobile && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={mobile ? 'modules-trigger' : 'nav-programs modules-trigger'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {mobile && <span className="mobile-navigation__number">01</span>}
        Modules
        <Icon name="chevron" />
      </button>
      <div id={panelId} className="modules-panel" hidden={!open}>
        <ul className="modules-list">
          {programs.map((program) => (
            <li key={program.id}>
              {program.status === 'featured' ? (
                <a
                  href={program.storyId ? `#${program.storyId}` : '#programs'}
                  onClick={() => setOpen(false)}
                >
                  <Icon name={program.symbol} />
                  <span>
                    <strong>{program.name}</strong>
                    <span className="modules-list__meta">{program.label}</span>
                  </span>
                  <Icon name="arrow-up" />
                </a>
              ) : (
                <div className="modules-list__planned">
                  <span className="modules-list__number">
                    0{program.position}
                  </span>
                  <span>
                    <strong>{program.label}</strong>
                    <span className="modules-list__meta">Coming soon</span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <a
          className="modules-panel__all"
          href="#programs"
          onClick={() => setOpen(false)}
        >
          Explore all modules
          <Icon name="arrow" />
        </a>
      </div>
    </div>
  );
}
