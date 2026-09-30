import { useId } from 'react';

const curves = [
  'M100 90C165 90 180 120 300 120',
  'M300 120C385 120 415 102 500 102',
  'M500 102C580 102 620 82 700 82',
  'M700 82C785 82 815 58 900 58',
  'M900 58C990 58 1015 28 1100 28',
];

const tabletCurves = [
  'M200 20H600',
  'M600 20H1000',
  'M1000 20C1170 20 1170 300 1000 300H230Q180 300 200 328',
  'M200 328H600',
  'M600 328H1000',
];

export function JourneyPath() {
  const id = useId();
  return (
    <>
      {[
        { name: 'desktop', curves, height: 160 },
        { name: 'tablet', curves: tabletCurves, height: 360 },
      ].map((route) => (
        <svg
          key={route.name}
          className={`roadmap-route roadmap-route--${route.name}`}
          viewBox={`0 0 1200 ${route.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={`${id}-${route.name}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="1200"
              y2="0"
            >
              <stop stopColor="#a7b2c6" />
              <stop offset=".25" stopColor="#32bada" />
              <stop offset=".48" stopColor="#9679e2" />
              <stop offset=".75" stopColor="#cf7bba" />
              <stop offset="1" stopColor="#edb75a" />
            </linearGradient>
          </defs>
          <g
            fill="none"
            stroke={`url(#${id}-${route.name})`}
            strokeLinecap="round"
          >
            {route.curves.map((d, index) => (
              <g key={d} data-route-stage={String(index + 2).padStart(2, '0')}>
                <path className="roadmap-route-halo" d={d} strokeWidth="24" />
                <path className="roadmap-route-line" d={d} strokeWidth="4" />
                <path
                  className="roadmap-route-highlight"
                  d={d}
                  strokeWidth="7"
                />
              </g>
            ))}
          </g>
        </svg>
      ))}
    </>
  );
}
