import type { CSSProperties } from 'react';
import type { journey } from '@/content/home';
import { JourneySymbol } from './JourneySymbol';

const colors = [
  '#636780',
  '#087eaa',
  '#295fc2',
  '#853fba',
  '#b03a81',
  '#925b0d',
];
const offsets = [18, 48, 30, 10, -14, -44];

export function JourneyStep({
  step,
  index,
}: {
  step: (typeof journey)[number];
  index: number;
}) {
  return (
    <li
      className="roadmap-milestone"
      data-stage={step.number}
      style={
        {
          '--stage-color': colors[index],
          '--stage-offset': `${offsets[index]}px`,
        } as CSSProperties
      }
    >
      <div className="roadmap-marker" aria-hidden="true">
        <span>{step.number}</span>
      </div>
      <article className="roadmap-card">
        <h3>
          <button
            type="button"
            disabled
            className="roadmap-select"
            data-stage-button={step.number}
            aria-pressed="false"
            aria-describedby={`journey-description-${step.number}`}
          >
            <span className="roadmap-symbol">
              <JourneySymbol index={index} />
            </span>
            <span>{step.title}</span>
          </button>
        </h3>
        <p id={`journey-description-${step.number}`}>{step.description}</p>
      </article>
    </li>
  );
}
