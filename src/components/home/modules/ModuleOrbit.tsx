import { useId } from 'react';
import { programs } from '@/content/programs';

// Presentation coordinates only; all module definitions remain in programs.ts.
const targets = [
  { x: 620, y: 74, nodeX: 620, nodeY: 170 },
  { x: 211, y: 170, nodeX: 390, nodeY: 220 },
  { x: 1029, y: 170, nodeX: 850, nodeY: 220 },
  { x: 155, y: 400, nodeX: 374, nodeY: 390 },
  { x: 1085, y: 400, nodeX: 866, nodeY: 390 },
  { x: 471, y: 569, nodeX: 509, nodeY: 478 },
  { x: 769, y: 569, nodeX: 731, nodeY: 478 },
];

export function ModuleOrbit() {
  const id = useId();
  return (
    <svg
      className="module-orbit"
      viewBox="0 0 1240 654"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-orbit`}>
          <stop stopColor="#4bb8dc" />
          <stop offset=".5" stopColor="#626ac4" />
          <stop offset="1" stopColor="#a480cf" />
        </linearGradient>
      </defs>
      <g className="module-orbit__rings" stroke={`url(#${id}-orbit)`}>
        <ellipse cx="620" cy="320" rx="500" ry="280" />
        <ellipse cx="620" cy="320" rx="354" ry="214" />
        <ellipse cx="620" cy="320" rx="247" ry="148" strokeDasharray="2 9" />
        <ellipse cx="620" cy="320" rx="141" ry="88" />
      </g>
      {programs.map((program, index) => {
        const target = targets[index];
        return (
          <g
            key={program.id}
            className={`module-path module-accent-${program.accent}`}
            data-path-position={program.position}
          >
            <path
              d={`M620 320Q${target.nodeX} ${target.nodeY} ${target.x} ${target.y}`}
            />
            <circle
              className="module-path__aura"
              cx={(620 + 2 * target.nodeX + target.x) / 4}
              cy={(320 + 2 * target.nodeY + target.y) / 4}
              r="10"
            />
            <circle
              className="module-path__node"
              cx={(620 + 2 * target.nodeX + target.x) / 4}
              cy={(320 + 2 * target.nodeY + target.y) / 4}
              r="3.5"
            />
          </g>
        );
      })}
      <g className="module-orbit__stars" fill="#b3caee">
        <circle cx="100" cy="105" r="1" />
        <circle cx="1010" cy="132" r="1.4" />
        <circle cx="92" cy="524" r="1.2" />
        <circle cx="1028" cy="490" r="1" />
        <circle cx="420" cy="196" r=".8" />
        <circle cx="702" cy="220" r=".8" />
      </g>
      <path
        className="module-orbit__gold"
        d="M853 59l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"
        fill="#efb767"
      />
    </svg>
  );
}
