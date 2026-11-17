export function HomepageAtmosphere() {
  return (
    <div className="homepage-atmosphere" aria-hidden="true">
      <div className="homepage-wireframe" />
      <div className="homepage-ambient-light" />
      <svg
        className="homepage-edge-waves"
        viewBox="0 0 1672 300"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient
            id="homepage-wave-line"
            x1="0"
            x2="1672"
            y1="50"
            y2="300"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8c51f3" />
            <stop offset=".28" stopColor="#26275d" />
            <stop offset=".5" stopColor="#10162b" stopOpacity="0" />
            <stop offset=".72" stopColor="#454cd1" />
            <stop offset="1" stopColor="#ab59f9" />
          </linearGradient>
          <linearGradient
            id="homepage-wave-fill"
            x1="0"
            x2="0"
            y1="0"
            y2="300"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#6130c2" stopOpacity=".26" />
            <stop offset="1" stopColor="#101a4b" stopOpacity=".05" />
          </linearGradient>
        </defs>
        <path
          d="M-80 60C180 35 145 205 480 278L650 330H-80ZM1050 330C1300 205 1395 70 1750 140V330Z"
          fill="url(#homepage-wave-fill)"
        />
        <path
          d="M-80 60C180 35 145 205 480 278M1050 330C1300 205 1395 70 1750 140"
          stroke="url(#homepage-wave-line)"
          strokeWidth="2"
        />
        <path
          d="M-80 288C80 170 280 220 415 245S585 280 680 330M1185 330C1405 190 1545 180 1750 260"
          stroke="url(#homepage-wave-line)"
          strokeOpacity=".4"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
