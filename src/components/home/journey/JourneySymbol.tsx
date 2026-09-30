const shapes = [
  <path
    key="stuck"
    d="M8 27v-9m0 0-5-5m5 5 5-5M24 27V7m0 0-4 4m4-4 4 4M13 7c0-4 7-4 7 0 0 3-3 2-3 5m0 3v.1"
  />,
  <g key="self">
    <circle cx="16" cy="10" r="5" />
    <path d="M6 28v-3a10 10 0 0 1 20 0v3M23 4l2-2m2 6h3" />
  </g>,
  <g key="explore">
    <circle cx="16" cy="16" r="12" />
    <path d="m21 11-3 7-7 3 3-7 7-3ZM16 1v3M16 28v3" />
  </g>,
  <g key="build">
    <path d="M4 27h24M6 23v-6h4v6m4 0V11h4v12m4 0V5h4v18M4 7l5-3 4 3" />
  </g>,
  <g key="opportunities">
    <circle cx="16" cy="16" r="9" />
    <ellipse cx="16" cy="16" rx="4" ry="9" />
    <path d="M7 16h18M5 5l3 3m16 16 3 3M27 5l-3 3M8 24l-3 3" />
    <circle cx="4" cy="4" r="2" />
    <circle cx="28" cy="28" r="2" />
  </g>,
  <g key="forward">
    <path d="M12 21 6 20l2-7 6-2M11 22l-1 5 5-1m4-7 2 7 5-6-1-5M11 21C12 11 20 4 28 4c0 8-7 16-17 17ZM5 27l3-3" />
    <circle cx="21" cy="11" r="2" />
  </g>,
];

export function JourneySymbol({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[index]}
    </svg>
  );
}
