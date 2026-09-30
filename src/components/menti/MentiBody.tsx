const silhouette =
  'M81 32C94 29 99 52 108 61C114 67 128 65 139 71C157 79 153 93 140 106L128 118C123 123 127 137 126 149C125 168 113 172 98 161L85 153C80 150 76 152 67 158C50 171 34 168 35 150L38 128C39 119 36 116 29 110L20 103C5 91 10 77 26 71L48 63C57 60 60 50 65 42C69 35 75 31 81 32Z';
export function MentiBody({ id }: { id: string }) {
  return (
    <g className="menti-body">
      <defs>
        <linearGradient
          id={`${id}-body`}
          x1="24"
          y1="40"
          x2="116"
          y2="166"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--menti-cyan, #51e5ff)" />
          <stop offset=".32" stopColor="var(--menti-blue, #426fff)" />
          <stop offset=".67" stopColor="var(--menti-violet, #9364ef)" />
          <stop offset="1" stopColor="#25319c" />
        </linearGradient>
        <radialGradient id={`${id}-magenta`} cx=".98" cy=".48" r=".75">
          <stop stopColor="var(--menti-magenta, #f593ed)" />
          <stop
            offset=".24"
            stopColor="var(--menti-magenta, #f593ed)"
            stopOpacity=".75"
          />
          <stop offset="1" stopColor="#b864ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-lower-light`} cx=".16" cy=".97" r=".65">
          <stop stopColor="var(--menti-magenta, #f593ed)" stopOpacity=".85" />
          <stop
            offset=".5"
            stopColor="var(--menti-violet, #9364ef)"
            stopOpacity=".5"
          />
          <stop offset="1" stopColor="#9364ef" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-face-light`} cx=".46" cy=".58" r=".58">
          <stop stopColor="#f4eaff" stopOpacity=".85" />
          <stop offset=".38" stopColor="#c2ceff" stopOpacity=".6" />
          <stop offset=".72" stopColor="#b8cfff" stopOpacity=".12" />
          <stop offset="1" stopColor="#b8cfff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-volume`} cx=".42" cy=".42" r=".65">
          <stop offset=".42" stopColor="#10206e" stopOpacity="0" />
          <stop offset=".76" stopColor="#19278d" stopOpacity=".14" />
          <stop offset="1" stopColor="#111757" stopOpacity=".6" />
        </radialGradient>
        <radialGradient id={`${id}-gloss`}>
          <stop stopColor="#f3ffff" stopOpacity=".8" />
          <stop offset=".45" stopColor="#a2f5ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#a2f5ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-specular`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#fff" stopOpacity=".95" />
          <stop offset=".5" stopColor="#dcffff" stopOpacity=".75" />
          <stop offset="1" stopColor="#83e9ff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-body-clip`}>
          <path d={silhouette} />
        </clipPath>
        <filter
          id={`${id}-bevel`}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur
            in="SourceAlpha"
            stdDeviation="3.5"
            result="soft-body"
          />
          <feOffset in="soft-body" dx="-3" dy="-4" result="shade-offset" />
          <feComposite
            in="SourceAlpha"
            in2="shade-offset"
            operator="out"
            result="shade-edge"
          />
          <feFlood floodColor="#101d75" floodOpacity=".75" />
          <feComposite in2="shade-edge" operator="in" result="shade" />
          <feOffset in="soft-body" dx="2" dy="3" result="light-offset" />
          <feComposite
            in="SourceAlpha"
            in2="light-offset"
            operator="out"
            result="light-edge"
          />
          <feFlood floodColor="#b5f6ff" floodOpacity=".8" />
          <feComposite in2="light-edge" operator="in" result="light" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shade" />
            <feMergeNode in="light" />
          </feMerge>
        </filter>
        <linearGradient
          id={`${id}-rim`}
          x1="15"
          y1="45"
          x2="142"
          y2="158"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e3fdff" />
          <stop offset=".4" stopColor="#91edff" />
          <stop offset=".7" stopColor="#f4c5ff" />
          <stop offset="1" stopColor="#86dcff" />
        </linearGradient>
      </defs>
      <path d={silhouette} fill="#34317c" transform="translate(1.2 2.5)" />
      <g filter={`url(#${id}-bevel)`}>
        <path d={silhouette} fill={`url(#${id}-body)`} />
        <path d={silhouette} fill={`url(#${id}-magenta)`} />
        <path d={silhouette} fill={`url(#${id}-lower-light)`} />
        <path d={silhouette} fill={`url(#${id}-volume)`} />
        <path d={silhouette} fill={`url(#${id}-face-light)`} />
      </g>
      <g clipPath={`url(#${id}-body-clip)`}>
        <ellipse
          cx="68"
          cy="58"
          rx="15"
          ry="30"
          transform="rotate(30 68 58)"
          fill={`url(#${id}-gloss)`}
        />
        <ellipse
          cx="129"
          cy="83"
          rx="18"
          ry="10"
          transform="rotate(22 129 83)"
          fill={`url(#${id}-gloss)`}
          opacity=".6"
        />
        <ellipse
          cx="105"
          cy="154"
          rx="23"
          ry="9"
          transform="rotate(25 105 154)"
          fill={`url(#${id}-gloss)`}
          opacity=".5"
        />
        <path
          d="M68 48Q77 32 81 39Q84 43 76 55L63 73Q52 81 33 85Q17 90 21 83Q25 77 42 75Q60 71 68 48Z"
          fill={`url(#${id}-specular)`}
        />
        <path
          d="M124 74Q147 74 142 87Q141 79 132 80Z"
          fill="#fff3ff"
          opacity=".85"
        />
      </g>
      <path
        d={silhouette}
        fill="none"
        stroke={`url(#${id}-rim)`}
        strokeWidth="1.5"
      />
      <path
        d="M76 39C68 43 68 59 58 65C48 72 25 74 20 84"
        fill="none"
        stroke="#e9fdff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".8"
      />
      <path
        d="M121 73Q146 76 141 86M118 145Q120 159 108 159"
        fill="none"
        stroke="#fff0ff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".6"
      />
      <path
        d="M42 132Q35 151 44 158"
        fill="none"
        stroke="#e4bdff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".65"
      />
      <g fill="#effbff" opacity=".55">
        <circle cx="44" cy="83" r=".8" />
        <circle cx="95" cy="64" r=".7" />
        <circle cx="127" cy="91" r=".8" />
        <circle cx="51" cy="147" r=".7" />
        <circle cx="93" cy="144" r=".7" />
        <circle cx="113" cy="136" r=".6" />
        <path d="M32 93L33 96L36 97L33 98L32 101L31 98L28 97L31 96Z" />
        <path d="M114 148L115 150L117 151L115 152L114 154L113 152L111 151L113 150Z" />
      </g>
    </g>
  );
}
