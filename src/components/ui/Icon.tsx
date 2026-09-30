import type { CSSProperties, ReactNode } from 'react';
export type IconName =
  | 'arrow'
  | 'arrow-up'
  | 'globe'
  | 'spark'
  | 'sunrise'
  | 'create'
  | 'mentor'
  | 'briefcase'
  | 'menu'
  | 'close'
  | 'chevron'
  | 'check';
const paths: Record<IconName, ReactNode> = {
  arrow: <path d="M4 12h15M13 5l7 7-7 7" />,
  'arrow-up': <path d="M5 19 19 5M5 5h14v14" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18M5 6.5h14M5 17.5h14" />
    </>
  ),
  spark: (
    <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
  ),
  sunrise: (
    <path d="M3 18h18M5 14a7 7 0 0 1 14 0M12 2v3M3.5 5.5l2 2M20.5 5.5l-2 2M2 11h2M20 11h2" />
  ),
  create: (
    <>
      <path d="m12 3 8 5v8l-8 5-8-5V8l8-5Z" />
      <path d="m4 8 8 5 8-5M12 13v8M8 5.5l8 5" />
    </>
  ),
  mentor: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4a4 4 0 0 1 0 8M18 15a5 5 0 0 1 3 5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V3h8v4M3 12a21 21 0 0 0 18 0M12 11v4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
};
export function Icon({
  name,
  className,
  style,
}: {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
