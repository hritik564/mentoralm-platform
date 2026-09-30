import { MentiEyes } from './MentiEyes';
/** Default expression is a visual layer; future variants need no new tracking state. */
export function MentiFace({ id }: { id: string }) {
  return (
    <g className="menti-face" data-expression="default">
      <path
        d="M45 77Q52 68 62 72M98 71Q109 66 116 73"
        stroke="#28246b"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <MentiEyes id={id} />
      <path
        d="M74 126Q83 135 93 125"
        fill="none"
        stroke="#292759"
        strokeWidth="2.7"
        strokeLinecap="round"
      />
      <path
        d="M78 133Q84 135 90 132"
        fill="none"
        stroke="#f3bded"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".75"
      />
      <ellipse cx="39" cy="120" rx="7" ry="3" fill="#ec9cdc" opacity=".3" />
      <ellipse cx="126" cy="118" rx="6" ry="3" fill="#f8acda" opacity=".3" />
    </g>
  );
}
