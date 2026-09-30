import { programs } from '@/content/programs';
import { Menti } from '@/components/menti/Menti';
import { ModuleCard, moduleAvailabilityDescription } from './ModuleCard';
import { ModuleOrbit } from './ModuleOrbit';
import { ModuleExperience } from './ModuleExperience';
import '@/styles/modules.css';

export function ModuleEcosystem() {
  return (
    <section
      id="programs"
      className="section module-ecosystem"
      aria-labelledby="ecosystem-heading"
    >
      <div className="container">
        <header className="module-heading" data-reveal>
          <p className="eyebrow">The MentoraLM ecosystem</p>
          <h2 id="ecosystem-heading">
            <span>One Intelligence.</span> <span>Different Paths.</span>
          </h2>
          <p>Seven specialised pathways. One unified MentoraLM ecosystem.</p>
        </header>
        <ModuleExperience count={programs.length}>
          <div className="module-scene">
            <ModuleOrbit />
            <div className="module-center" data-reveal>
              <span className="module-center__halo" aria-hidden="true" />
              <Menti />
              <p>
                One connected ecosystem.
                <span>Find your path with MentoraLM.</span>
              </p>
            </div>
            <ol
              className="module-discovery"
              id="module-discovery"
              aria-label="Seven MentoraLM modules"
            >
              {programs.map((program) => (
                <li
                  className="module-slot"
                  data-module-position={program.position}
                  key={program.id}
                >
                  <ModuleCard program={program} />
                </li>
              ))}
            </ol>
          </div>
        </ModuleExperience>
        <p className="module-disclosure">
          Explore the vision. Program details and enrollment are coming next.
        </p>
        {programs
          .filter(
            (program) => program.status === 'featured' && !program.storyId,
          )
          .map((program) => (
            <aside
              key={program.id}
              id={`module-${program.id}-availability`}
              className="module-availability"
              aria-label={`${program.name} availability`}
            >
              <h3>{program.name}</h3>
              <p>{moduleAvailabilityDescription(program)}</p>
              <a href="#programs">Return to modules</a>
            </aside>
          ))}
      </div>
      <noscript>
        <style>{`.module-ecosystem .menti-character, .module-ecosystem .menti-eyes { animation: none !important; }`}</style>
      </noscript>
    </section>
  );
}
