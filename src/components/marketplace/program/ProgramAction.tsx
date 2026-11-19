import type { PublicOffering } from '@/lib/marketplace/types';
import { EnrollButton } from '../enrollment/EnrollButton';
import { programActionLabels } from './presentation';

/** Only published OPEN programs with an announced price can start enrollment. */
export function ProgramAction({ offering }: { offering: PublicOffering }) {
  if (offering.availabilityStatus === 'OPEN' && offering.priceMinor !== null)
    return (
      <div className="program-action">
        <EnrollButton slug={offering.slug} />
        <p className="program-action-note">
          Confirm your details before checkout. No payment is collected yet.
        </p>
      </div>
    );
  return (
    <div className="program-action">
      <p className="program-action-label">
        {programActionLabels[offering.availabilityStatus]}
      </p>
      <p className="program-action-note">
        {offering.availabilityStatus === 'CLOSED'
          ? 'Enrollment is currently closed for this program.'
          : offering.availabilityStatus === 'OPEN'
            ? 'Program price will be announced before enrollment opens.'
            : 'Enrollment is not available for this program yet.'}
      </p>
    </div>
  );
}
