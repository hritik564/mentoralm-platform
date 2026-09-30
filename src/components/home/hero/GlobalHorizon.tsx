import { useId } from 'react';

export function GlobalHorizon() {
  const id = useId();
  return (
    <div
      className="hero-horizon hero-enter hero-enter--ambient"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 260"
        fill="none"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <radialGradient id={`${id}-earth`} cx=".5" cy="0" r=".9">
            <stop stopColor="#215289" />
            <stop offset=".48" stopColor="#10203e" />
            <stop offset="1" stopColor="#0b0f1b" />
          </radialGradient>
          <linearGradient id={`${id}-edge`}>
            <stop stopColor="#7650c7" stopOpacity="0" />
            <stop offset=".45" stopColor="#69dced" />
            <stop offset=".75" stopColor="#98c7ff" />
            <stop offset="1" stopColor="#7650c7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 260Q550-140 1200 260Z" fill={`url(#${id}-earth)`} />
        <path
          d="M0 260Q550-140 1200 260"
          stroke={`url(#${id}-edge)`}
          strokeWidth="7"
          opacity=".12"
        />
        <path
          d="M0 260Q550-140 1200 260"
          stroke={`url(#${id}-edge)`}
          strokeWidth="1.5"
          opacity=".8"
        />
        {/* Abstract night-side land and city light clusters, not geographic listings. */}
        <g fill="#274b75" opacity=".14">
          <path d="M254 166Q263 142 295 140Q319 122 344 133Q364 125 377 145Q366 152 362 164Q382 166 387 177Q371 187 350 180Q329 183 315 195Q303 218 283 206Q270 201 262 188Z" />
          <path d="M394 200Q419 189 437 204Q458 214 448 236Q442 250 425 260Q415 243 408 225Q397 216 394 200Z" />
          <path d="M564 119Q580 99 600 111Q608 127 622 120Q644 103 661 117Q686 109 710 123Q728 115 748 130Q773 130 794 145Q820 142 837 164Q825 182 805 175Q786 157 766 168Q750 193 733 178Q713 172 705 158Q686 140 671 151Q649 166 632 151Q614 155 603 140Q580 156 564 144Z" />
          <path d="M592 168Q615 153 636 167Q650 168 660 183Q657 203 641 218Q630 239 621 234Q608 224 605 207Q586 192 592 168Z" />
          <path d="M850 219Q865 200 887 210Q907 206 915 223Q909 237 891 237Q869 235 850 219Z" />
        </g>
        <path
          d="M292 157h.1M306 151h.1M318 166h.1M339 151h.1M346 174h.1M370 179h.1M411 219h.1M433 234h.1M575 128h.1M591 120h.1M600 134h.1M614 128h.1M631 149h.1M652 136h.1M678 134h.1M701 147h.1M721 155h.1M740 162h.1M780 159h.1M803 173h.1M622 183h.1M634 205h.1M876 219h.1M891 226h.1"
          stroke="#e8bd87"
          strokeWidth="2.3"
          strokeLinecap="round"
          opacity=".6"
        />
        <g stroke="#98c7ff" strokeWidth=".8" opacity=".27" fill="none">
          <path d="M314 173Q527 56 760 150M596 138Q747 94 907 211" />
        </g>
        <path
          d="M395 174Q581 120 796 180"
          stroke="#f3b86f"
          strokeWidth=".8"
          opacity=".38"
        />
        <g fill="#f3b86f">
          <circle cx="395" cy="174" r="8" opacity=".1" />
          <circle cx="395" cy="174" r="2.7" />
          <circle cx="796" cy="180" r="7" opacity=".1" />
          <circle cx="796" cy="180" r="2.5" />
        </g>
        <g fill="#69dced">
          <circle cx="596" cy="138" r="8" opacity=".1" />
          <circle cx="596" cy="138" r="2.5" />
          <circle cx="907" cy="211" r="2" />
        </g>
      </svg>
      <span className="hero-horizon__label hero-horizon__label--study">
        Study Abroad
      </span>
      <span className="hero-horizon__label hero-horizon__label--career">
        Global Careers
      </span>
      <span className="hero-horizon__label hero-horizon__label--skills">
        Future-Ready Skills
      </span>
    </div>
  );
}
