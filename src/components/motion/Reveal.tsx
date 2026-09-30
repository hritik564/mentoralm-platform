import type { HTMLAttributes, CSSProperties } from 'react';

/** Uses the page's shared MotionObserver; server-rendered content stays visible. */
export function Reveal({
  variant = 'fade',
  stagger = 0,
  className = '',
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: 'fade' | 'scale';
  stagger?: 0 | 1 | 2;
}) {
  return (
    <div
      {...props}
      data-reveal
      className={`motion-reveal motion-reveal--${variant} ${className}`}
      style={
        {
          ...style,
          '--reveal-delay': `var(--motion-stagger-${stagger === 1 ? 'one' : stagger === 2 ? 'two' : 'none'})`,
        } as CSSProperties
      }
    />
  );
}
