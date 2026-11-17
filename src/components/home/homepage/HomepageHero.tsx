import '@/styles/homepage-hero.css';
import { homepagePrograms } from './programs';
import { ProgramCarousel } from './ProgramCarousel';
import { ProgramSlide } from './ProgramSlide';
import { HomepageAtmosphere } from './HomepageAtmosphere';
import { HeroCTA } from './HeroCTA';
export function HomepageHero() {
  return (
    <section className="homepage-hero" aria-labelledby="homepage-heading">
      <HomepageAtmosphere />
      <ProgramCarousel
        programs={homepagePrograms.map((program, index) => ({
          ...program,
          content: <ProgramSlide program={program} preload={index === 0} />,
        }))}
      />
      <HeroCTA />
      <aside
        className="homepage-program-fallback"
        id="youngminds-ai-lab"
        aria-labelledby="youngminds-information-heading"
      >
        <h2 id="youngminds-information-heading">YoungMinds AI Lab</h2>
        <p>
          AI &amp; Tech Discovery for Young Learners. Full program details,
          eligibility and enrollment are not available yet.
        </p>
      </aside>
    </section>
  );
}
