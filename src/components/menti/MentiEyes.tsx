export function MentiEyes({ id }: { id: string }) {
  return (
    <g className="menti-eyes">
      <defs>
        <radialGradient id={`${id}-eye-white`} cx=".38" cy=".42" r=".65">
          <stop offset=".4" stopColor="#fff" />
          <stop offset=".75" stopColor="#e6eaff" />
          <stop offset="1" stopColor="#a19bda" />
        </radialGradient>
        <radialGradient id={`${id}-eye-socket`}>
          <stop offset=".66" stopColor="#211452" stopOpacity=".6" />
          <stop offset="1" stopColor="#211452" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-iris`} x1="0" y1="0" x2=".3" y2="1">
          <stop stopColor="#0c123e" />
          <stop offset=".48" stopColor="#4131a4" />
          <stop offset=".8" stopColor="#405ef7" />
          <stop offset="1" stopColor="#53e5ff" />
        </linearGradient>
      </defs>
      <ellipse
        cx="60"
        cy="104"
        rx="22"
        ry="28"
        fill={`url(#${id}-eye-socket)`}
        transform="rotate(-8 60 104)"
      />
      <ellipse
        cx="105"
        cy="102"
        rx="22"
        ry="28"
        fill={`url(#${id}-eye-socket)`}
        transform="rotate(8 105 102)"
      />
      <ellipse
        cx="60"
        cy="103"
        rx="18"
        ry="24"
        fill={`url(#${id}-eye-white)`}
        stroke="#302263"
        strokeWidth="2.5"
        transform="rotate(-8 60 103)"
      />
      <ellipse
        cx="105"
        cy="101"
        rx="18"
        ry="24"
        fill={`url(#${id}-eye-white)`}
        stroke="#302263"
        strokeWidth="2.5"
        transform="rotate(8 105 101)"
      />
      <path
        d="M40 104Q41 78 61 78M105 76Q124 76 126 98"
        fill="none"
        stroke="#261b56"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <g className="menti-pupils">
        <ellipse
          cx="62"
          cy="104"
          rx="12.5"
          ry="19"
          fill={`url(#${id}-iris)`}
          stroke="#201c57"
          strokeWidth=".8"
        />
        <ellipse
          cx="103"
          cy="102"
          rx="12.5"
          ry="19"
          fill={`url(#${id}-iris)`}
          stroke="#201c57"
          strokeWidth=".8"
        />
        <ellipse cx="63" cy="103" rx="7.5" ry="12" fill="#080e32" />
        <ellipse cx="104" cy="101" rx="7.5" ry="12" fill="#080e32" />
        <path
          d="M57 85L59 90L64 92L59 94L57 99L55 94L50 92L55 90Z"
          fill="#fff"
        />
        <path
          d="M98 83L100 88L105 90L100 92L98 97L96 92L91 90L96 88Z"
          fill="#fff"
        />
        <ellipse cx="65" cy="117" rx="4" ry="2" fill="#7ff4ff" opacity=".8" />
        <ellipse cx="106" cy="115" rx="4" ry="2" fill="#7ff4ff" opacity=".8" />
        <circle cx="68" cy="95" r="1.7" fill="#fff" opacity=".7" />
        <circle cx="109" cy="93" r="1.7" fill="#fff" opacity=".7" />
      </g>
    </g>
  );
}
