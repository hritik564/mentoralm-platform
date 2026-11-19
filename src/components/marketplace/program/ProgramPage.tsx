import { Icon } from '@/components/ui/Icon';
import { websiteHref } from '@/lib/platform/domains';
import type { PublicProgram } from '@/lib/marketplace/page-types';
import { ProgramHero } from './ProgramHero';
import { ProgramSummary } from './ProgramSummary';
import { ProgramSectionRenderer } from './ProgramSectionRenderer';

export function ProgramPage({ program }: { program: PublicProgram }) {
  return (
    <main id="main-content" className="marketplace program-page">
      <div className="container">
        <ProgramHero program={program} />
        <div className="program-content-layout">
          <div className="program-content">
            {program.page.sections.length ? (
              program.page.sections.map((section, index) => (
                <ProgramSectionRenderer
                  key={index}
                  section={section}
                  index={index}
                />
              ))
            ) : (
              <section
                className="program-content-section program-basic-overview"
                aria-labelledby="program-basic-heading"
              >
                <p className="program-eyebrow">About the program</p>
                <h2 id="program-basic-heading">{program.title}</h2>
                <p className="program-section-body">
                  {program.shortDescription}
                </p>
              </section>
            )}
          </div>
          <ProgramSummary program={program} />
        </div>
        <nav
          className="program-bottom-navigation"
          aria-label="Course catalogue"
        >
          <span>MentoraLM Courses &amp; Programs</span>
          <a href={websiteHref('/courses')}>
            Explore all courses <Icon name="arrow" />
          </a>
        </nav>
      </div>
    </main>
  );
}
