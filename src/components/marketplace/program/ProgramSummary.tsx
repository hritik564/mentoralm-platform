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

export function ProgramSummary({ program }: { program: PublicProgram }) {
  return (
    <aside className="program-summary" aria-labelledby="program-summary-title">
      <div className="program-summary-topline">
        <p className="program-eyebrow">Program at a glance</p>
        <Icon name="spark" />
      </div>
      <h2 id="program-summary-title">{program.title}</h2>
      <div className="program-summary-price">
        <span>Program fee</span>
        <strong>{programPrice(program)}</strong>
      </div>
      <dl className="program-summary-facts">
        <div>
          <dt>Duration</dt>
          <dd>{program.durationLabel || 'To be announced'}</dd>
        </div>
        <div>
          <dt>Learning mode</dt>
          <dd>{programDeliveryLabels[program.deliveryMode]}</dd>
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
        <div>
          <dt>Availability</dt>
          <dd>{programAvailabilityLabels[program.availabilityStatus]}</dd>
        </div>
      </dl>
      <ProgramAction offering={program} />
      <a className="program-catalogue-link" href={websiteHref('/courses')}>
        Explore all courses <Icon name="arrow" />
      </a>
    </aside>
  );
}
