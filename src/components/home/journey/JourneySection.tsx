import { journey } from '@/content/home';
import { Reveal } from '@/components/motion/Reveal';
import { JourneyExperience } from './JourneyExperience';
import { JourneyPath } from './JourneyPath';
import { JourneyStep } from './JourneyStep';
import { JourneyMentiGuide } from './JourneyMentiGuide';
import { JourneyLandscape } from './JourneyLandscape';
import '@/styles/journey.css';

export function JourneySection() {
  return (
    <section id="journey" className="roadmap" aria-labelledby="journey-heading">
      <JourneyLandscape />
      <div className="container roadmap-container">
        <Reveal className="roadmap-heading">
          <p className="roadmap-eyebrow">The MentoraLM Journey</p>
          <h2 id="journey-heading">
            Where you are today.
            <br />
            <em>Where you can go next.</em>
          </h2>
          <p className="roadmap-support">
            A guided roadmap from uncertainty to confident action.
          </p>
        </Reveal>
        <JourneyExperience>
          <JourneyMentiGuide />
          <div className="roadmap-stage">
            <JourneyPath />
            <ol className="roadmap-steps" aria-label="Your six-stage journey">
              {journey.map((step, index) => (
                <JourneyStep key={step.number} step={step} index={index} />
              ))}
            </ol>
          </div>
        </JourneyExperience>
        <p className="roadmap-caption">
          <span>Your starting point isn’t your destination.</span>
          <span>
            A vision for your journey. Guidance and matching are in development.
          </span>
        </p>
      </div>
    </section>
  );
}
