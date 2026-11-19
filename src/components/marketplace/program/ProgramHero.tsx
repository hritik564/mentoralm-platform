import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { websiteHref } from '@/lib/platform/domains';
import type { PublicProgram } from '@/lib/marketplace/page-types';
import { ProgramAction } from './ProgramAction';
import {
  programAvailabilityLabels,
  programDeliveryLabels,
  programPrice,
  programStartDate,
} from './presentation';

function ProgramArtwork({ program }: { program: PublicProgram }) {
  const image = program.heroImage || program.cardImage;
  return (
    <div className={`program-hero-art${image ? '' : ' is-fallback'}`}>
      {image ? (
        <Image
          src={image}
          alt={`${program.title} program visual`}
          fill
          priority
          sizes="(max-width: 820px) 90vw, 44vw"
        />
      ) : (
        <div className="program-artwork-fallback" aria-hidden="true">
          <svg viewBox="0 0 500 460" fill="none">
            <ellipse cx="250" cy="230" rx="205" ry="112" />
            <ellipse cx="250" cy="230" rx="165" ry="90" />
            <ellipse cx="250" cy="230" rx="124" ry="68" />
            <path d="M62 382 438 78M62 78l376 304M250 25v410" />
            <circle cx="87" cy="162" r="5" />
            <circle cx="405" cy="298" r="5" />
            <circle cx="250" cy="118" r="5" />
          </svg>
          <span className="program-artwork-core">
            <Icon name="spark" />
          </span>
        </div>
      )}
      <span className="program-artwork-corner" aria-hidden="true">
        <Icon name="spark" />
      </span>
    </div>
  );
}

export function ProgramHero({ program }: { program: PublicProgram }) {
  return (
    <header className="program-hero">
      <nav className="program-breadcrumb" aria-label="Breadcrumb">
        <a href={websiteHref('/courses')}>
          <Icon name="arrow" /> All courses &amp; programs
        </a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{program.title}</span>
      </nav>
      <div className="program-hero-grid">
        <div className="program-hero-copy">
          <div className="program-hero-labels">
            <p className="program-category">{program.category}</p>
            <span className="program-availability">
              <span aria-hidden="true" />
              {programAvailabilityLabels[program.availabilityStatus]}
            </span>
          </div>
          {program.page.eyebrow && (
            <p className="program-eyebrow">{program.page.eyebrow}</p>
          )}
          <h1>{program.page.heroHeadline || program.title}</h1>
          {program.page.heroHeadline && (
            <p className="program-hero-name">{program.title}</p>
          )}
          <p className="program-hero-description">
            {program.page.heroSummary || program.shortDescription}
          </p>
          <dl className="program-hero-facts">
            <div>
              <dt>Learning mode</dt>
              <dd>{programDeliveryLabels[program.deliveryMode]}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{program.durationLabel || 'To be announced'}</dd>
            </div>
            <div>
              <dt>Program fee</dt>
              <dd>{programPrice(program)}</dd>
            </div>
            {program.cohortStartsAt && (
              <div>
                <dt>Starts</dt>
                <dd>
                  <time dateTime={program.cohortStartsAt}>
                    {programStartDate(program.cohortStartsAt)}
                  </time>
                </dd>
              </div>
            )}
          </dl>
          <ProgramAction offering={program} />
        </div>
        <ProgramArtwork program={program} />
      </div>
    </header>
  );
}
