import type { HTMLAttributes } from 'react';

export type GlassTone = 'dark' | 'light' | 'elevated';

/** A readable surface; interactive styling does not add interaction semantics. */
export function GlassSurface({
  tone = 'dark',
  interactive = false,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: GlassTone;
  interactive?: boolean;
}) {
  return (
    <div
      {...props}
      className={`glass-surface glass-surface--${tone}${interactive ? ' glass-surface--interactive' : ''} ${className}`}
    />
  );
}
