import type { Program } from '@/content/programs';
import { Icon } from '@/components/ui/Icon';
import { NoticeButton } from '@/components/ui/NoticeButton';
export function ProgramCard({ program }: { program: Program }) {
  const comingSoon = program.status === 'coming-soon';
  return (
    <article
      className={`program-card accent-${program.accent} ${comingSoon ? 'program-card--soon' : ''}`}
      data-reveal
    >
      <div className="program-card__top">
        <span className="program-card__position">0{program.position}</span>
        {comingSoon ? (
          <span className="program-card__status">In the making</span>
        ) : (
          <Icon name={program.symbol} className="program-card__icon" />
        )}
      </div>
      <div className="program-card__art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="program-card__content">
        <p className="program-card__label">{program.label}</p>
        <h3>{program.name}</h3>
        <p>{program.description}</p>
      </div>
      {program.status === 'featured' ? (
        program.storyId ? (
          <a
            className="program-card__link"
            href={`#${program.storyId}`}
            aria-label={`Explore ${program.name}`}
          >
            Explore pathway
            <Icon name="arrow-up" />
          </a>
        ) : (
          <NoticeButton
            className="program-card__link"
            arrow
            title={program.name}
            description={`${program.description} Full program details and enrollment information will be shared in a later release. No applications are being accepted in this preview.`}
          >
            Explore pathway<span className="sr-only">: {program.name}</span>
          </NoticeButton>
        )
      ) : (
        <p className="program-card__coming">
          <span />
          Coming soon
        </p>
      )}
    </article>
  );
}
