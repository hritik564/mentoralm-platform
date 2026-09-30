import { useId } from 'react';

export function IntelligencePaths() {
  const id = useId();
  const paths = [
    'M60 174C0 40 586 8 598 156C615 310 154 465 38 356',
    'M74 468C-72 362 425 179 605 329C707 416 274 627 129 523',
    'M71 500C150 613 550 551 580 412',
  ];
  return (
    <svg
      className="hero-pathways hero-enter hero-enter--ambient"
      viewBox="0 0 640 620"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-path`}
          x1="40"
          y1="180"
          x2="595"
          y2="440"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#69dced" />
          <stop offset=".4" stopColor="#84a3ff" />
          <stop offset=".7" stopColor="#9d6de1" />
          <stop offset="1" stopColor="#d549a6" />
        </linearGradient>
      </defs>
      <path
        d={paths[1]}
        stroke={`url(#${id}-path)`}
        strokeWidth="7"
        opacity=".1"
        className="hero-pathway-aura"
      />
      {paths.map((d, index) => (
        <path
          key={d}
          d={d}
          stroke={`url(#${id}-path)`}
          className={`hero-pathway hero-pathway--${index}`}
        />
      ))}
      <path
        d="M40 518C130 608 374 597 573 652"
        stroke={`url(#${id}-path)`}
        strokeWidth="1.2"
        opacity=".45"
        className="hero-pathway-bridge"
      />
      <path
        d={paths[1]}
        stroke={`url(#${id}-path)`}
        className="hero-pathway-highlight"
      />
      <circle cx="57" cy="358" r="3" className="hero-glow-node" />
      <circle
        cx="581"
        cy="411"
        r="3"
        className="hero-glow-node hero-glow-node--violet"
      />
      <circle cx="146" cy="99" r="2" fill="#c6b5f0" />
      <circle cx="512" cy="67" r="2" fill="#98c7ff" />
    </svg>
  );
}
