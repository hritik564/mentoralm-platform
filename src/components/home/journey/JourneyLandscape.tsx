/** Code-native atmosphere; never a second mascot or essential content. */
export function JourneyLandscape() {
  return (
    <div className="roadmap-atmosphere" aria-hidden="true">
      <div className="roadmap-sun" />
      <div className="roadmap-horizon" />
      <svg
        className="roadmap-landscape"
        viewBox="0 0 1600 360"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          fill="#e2e8f5"
          d="M0 220 105 128 160 176 250 30 365 155 440 95 580 214 680 110 810 200 980 164 1180 240 1600 185V360H0Z"
        />
        <path
          fill="#cbd7eb"
          d="M0 250 80 175 135 202 230 64 335 204 410 145 500 245 625 155 740 250 850 198 990 280 1200 210 1600 250V360H0Z"
        />
        <path
          fill="#e1e5f4"
          d="M0 300 160 260 280 180 380 295 530 231 670 300 820 235 1000 300 1210 249 1370 290 1600 234V360H0Z"
        />
        <path
          fill="#f1e8ee"
          d="M0 330Q350 275 650 330T1260 310Q1450 235 1600 280V360H0Z"
        />
        <g fill="#a8b6d6" opacity=".7">
          <path d="M1280 270v-55h18v55m15 0v-90h22v90m18 0V125l14-24 14 24v145m18 0v-70h20v70m16 0V154l12-14 12 14v116m20 0v-42h20v42m15 0v-100h24v100" />
        </g>
        <g fill="none" stroke="#b17d32" strokeWidth="2" opacity=".7">
          <path d="M1480 136V80m0 0q12-6 24 0v16q-12-6-24 0" />
        </g>
        <g fill="none" stroke="#aab5ce" strokeWidth="2" opacity=".55">
          <path d="M1100 135q10-8 20 0 10-8 20 0M1170 106q7-6 14 0 7-6 14 0M1055 169q6-5 12 0 6-5 12 0" />
        </g>
      </svg>
      <div className="roadmap-cloud roadmap-cloud--left" />
      <div className="roadmap-cloud roadmap-cloud--right" />
    </div>
  );
}
