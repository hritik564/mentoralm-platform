import { useId } from 'react';
import { MentiBody } from './MentiBody';
import { MentiFace } from './MentiFace';
import { MentiCap } from './MentiCap';
import '@/styles/menti.css';

/** Independent visual layers keep future expressions separate from interaction state. */
export function Menti({
  decorative = true,
  className = '',
}: {
  decorative?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <span className={`menti-character ${className}`}>
      <svg
        viewBox="0 0 164 180"
        aria-hidden={decorative ? true : undefined}
        role={decorative ? undefined : 'img'}
        aria-label={
          decorative ? undefined : 'Menti, MentoraLM’s upcoming AI guide'
        }
      >
        <MentiBody id={id} />
        <MentiFace id={id} />
        <MentiCap id={id} />
      </svg>
    </span>
  );
}
