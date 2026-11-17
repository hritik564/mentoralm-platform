import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { NoticeButton } from '@/components/ui/NoticeButton';
import type { HomepageProgram } from './programs';

export function ProgramSlide({
  program,
  preload = false,
}: {
  program: HomepageProgram;
  preload?: boolean;
}) {
  return (
    <>
      <div className="homepage-slide-visual">
        <Image
          src={program.image}
          alt={program.imageAlt}
          fill
          preload={preload}
          sizes="(max-width: 900px) 94vw, 76vw"
        />
      </div>
      <div className="homepage-slide-shade" aria-hidden="true" />
      <div className="homepage-slide-copy">
        <p className="homepage-program-eyebrow">
          MentoraLM Program <span aria-hidden="true" />
        </p>
        <h2>
          {program.id === 'careerignite' ? (
            <>
              Career<span>Ignite</span>
            </>
          ) : (
            <>
              YoungMinds <span>AI Lab</span>
            </>
          )}
        </h2>
        <p className="homepage-program-subtitle">{program.subtitle}</p>
        <ul
          className="homepage-feature-pills"
          aria-label={`${program.title} features`}
        >
          {program.features.map((feature) => (
            <li key={feature.label}>
              <Icon name={feature.icon} />
              {feature.label}
            </li>
          ))}
        </ul>
        {program.id === 'careerignite' ? (
          <a className="homepage-button" href="#story-careerignite">
            Explore Program <Icon name="arrow" />
          </a>
        ) : (
          <NoticeButton
            href="#youngminds-ai-lab"
            className="homepage-button"
            title="YoungMinds AI Lab"
            description="AI & Tech Discovery for Young Learners. Full program details, eligibility and enrollment are not available yet. Explore the MentoraLM pathways while this program is being prepared."
            arrow
          >
            Explore Program
          </NoticeButton>
        )}
      </div>
      <div className="homepage-program-orbit" aria-hidden="true" />
    </>
  );
}
