import type { PublicProgramSection } from '@/lib/marketplace/page-types';
import { ProgramTextSection } from './ProgramTextSection';
import { ProgramListSection } from './ProgramListSection';
import { ProgramCurriculumSection } from './ProgramCurriculumSection';
import { ProgramFaqSection } from './ProgramFaqSection';

function SectionContent({ section }: { section: PublicProgramSection }) {
  switch (section.type) {
    case 'OVERVIEW':
    case 'TEXT':
      return <ProgramTextSection body={section.content.body} />;
    case 'OUTCOMES':
    case 'ELIGIBILITY':
    case 'WHO_IS_IT_FOR':
    case 'HIGHLIGHTS':
      return <ProgramListSection items={section.content.items} />;
    case 'CURRICULUM':
      return <ProgramCurriculumSection modules={section.content.modules} />;
    case 'FAQ':
      return <ProgramFaqSection items={section.content.items} />;
  }
}

export function ProgramSectionRenderer({
  section,
  index,
}: {
  section: PublicProgramSection;
  index: number;
}) {
  const headingId = `program-section-${index + 1}`;
  return (
    <section
      className={`program-content-section program-content-section--${section.type.toLowerCase()}`}
      aria-labelledby={headingId}
      data-program-section={section.type}
    >
      <header className="program-section-heading">
        <span className="program-section-number" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div>
          <h2 id={headingId}>{section.title}</h2>
          {section.subtitle && <p>{section.subtitle}</p>}
        </div>
      </header>
      <SectionContent section={section} />
    </section>
  );
}
