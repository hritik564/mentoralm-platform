import Image from 'next/image';
import type { Program } from '@/content/programs';
import { Icon } from '@/components/ui/Icon';
import { NoticeButton } from '@/components/ui/NoticeButton';

export function ModuleCard({ program }: { program: Program }) {
  const featured = program.status === 'featured';
  const headingId = `module-${program.id}`;
  const noticeId = `module-${program.id}-availability`;
  const className = `program-card module-card module-accent-${program.accent}${featured ? '' : ' program-card--soon module-card--soon'}`;
  const attributes = {
    className,
    'data-module-id': program.id,
    'data-module-status': program.status,
  };
  const content = (
    <>
      <div className="module-card__media">
        {featured ? (
          <Image
            src={program.thumbnail}
            alt=""
            fill
            sizes="(max-width: 640px) 85vw, (max-width: 1100px) 45vw, 120px"
          />
        ) : (
          <div className="module-card__future" aria-hidden="true">
            <span />
            <span />
          </div>
        )}
      </div>
      <div className="module-card__body">
        <div className="module-card__identity">
          <span className="module-card__number">0{program.position}</span>
          {featured ? (
            <Icon name={program.symbol} />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="5" y="10" width="14" height="11" rx="3" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
            </svg>
          )}
        </div>
        <h3 id={headingId}>{program.name}</h3>
        <p>
          {program.id === 'career-counsellor'
            ? program.description
            : program.label}
        </p>
        {featured ? (
          <Icon name="arrow-up" className="module-card__arrow" />
        ) : (
          <span className="module-card__unavailable">In development</span>
        )}
      </div>
    </>
  );
  if (!featured)
    return (
      <article {...attributes} aria-labelledby={headingId}>
        {content}
      </article>
    );
  if (program.storyId)
    return (
      <a
        {...attributes}
        href={`#${program.storyId}`}
        aria-label={`Explore ${program.name}`}
      >
        {content}
      </a>
    );
  const description = moduleAvailabilityDescription(program);
  return (
    <div className="module-card-with-notice">
      <NoticeButton
        className={className}
        href={`#${noticeId}`}
        accessibleName={`Explore ${program.name}`}
        dataAttributes={{
          'data-module-id': program.id,
          'data-module-status': program.status,
        }}
        title={program.name}
        description={description}
      >
        {content}
      </NoticeButton>
    </div>
  );
}

export function moduleAvailabilityDescription(program: Program) {
  return `${program.description} Full program details and enrollment information will be shared in a later release. No applications are being accepted in this preview.`;
}
