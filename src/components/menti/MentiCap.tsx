export function MentiCap({ id }: { id: string }) {
  return (
    <g className="menti-cap">
      <defs>
        <linearGradient
          id={`${id}-cap-top`}
          x1="40"
          y1="13"
          x2="121"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#234578" />
          <stop offset=".3" stopColor="#101931" />
          <stop offset=".75" stopColor="#15112e" />
          <stop offset="1" stopColor="#4d2c7a" />
        </linearGradient>
        <linearGradient id={`${id}-cap-band`}>
          <stop stopColor="#12233d" />
          <stop offset=".4" stopColor="#263961" />
          <stop offset=".7" stopColor="#11172d" />
          <stop offset="1" stopColor="#44316b" />
        </linearGradient>
        <linearGradient id={`${id}-gold`}>
          <stop stopColor="#f7dc8b" />
          <stop offset=".55" stopColor="#ffb54c" />
          <stop offset="1" stopColor="#bc781c" />
        </linearGradient>
      </defs>
      <path
        d="M54 32L117 30L119 49Q102 62 64 54L53 48Z"
        fill={`url(#${id}-cap-band)`}
        stroke="#6170a0"
        strokeWidth=".8"
      />
      <path
        d="M55 46Q75 37 94 42"
        fill="none"
        stroke="#8fbaf5"
        strokeWidth="1"
        opacity=".45"
      />
      <path
        d="M29 30L88 51L143 33L143 37L88 55L29 34Z"
        fill="#080e26"
        stroke="#6661a1"
        strokeWidth=".7"
      />
      <path
        d="M29 27L88 9Q92 8 96 10L143 29Q147 31 143 34L88 51L29 31Q25 29 29 27Z"
        fill={`url(#${id}-cap-top)`}
        stroke="#95aeeb"
        strokeWidth="1.3"
      />
      <path
        d="M30 27L89 10M96 11L141 29"
        fill="none"
        stroke="#c3efff"
        strokeWidth="1.3"
        opacity=".85"
      />
      <path
        d="M91 50L143 33"
        fill="none"
        stroke="#bb84ee"
        strokeWidth="1.5"
        opacity=".85"
      />
      <path
        d="M92 28Q122 22 139 33Q146 41 147 60"
        fill="none"
        stroke={`url(#${id}-gold)`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="92" cy="28" r="2" fill="#b5a4cd" />
      <ellipse cx="147" cy="60" rx="2.7" ry="4" fill={`url(#${id}-gold)`} />
      <path
        d="M148 64L150 69L156 70L152 74L153 80L148 77L143 80L144 74L140 70L146 69Z"
        fill={`url(#${id}-gold)`}
        stroke="#ffe5a5"
        strokeWidth=".7"
      />
    </g>
  );
}
