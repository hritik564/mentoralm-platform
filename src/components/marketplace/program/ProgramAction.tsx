import type { PublicOffering } from '@/lib/marketplace/types';
import { programActionLabels } from './presentation';

/** An availability notice, rather than a checkout or enrollment interaction. */
export function ProgramAction({ offering }: { offering: PublicOffering }) {
  return (
    <div className="program-action">
      <p className="program-action-label">
        {programActionLabels[offering.availabilityStatus]}
      </p>
      <p className="program-action-note">
        {offering.availabilityStatus === 'CLOSED'
          ? 'Enrollment is currently closed for this program.'
          : 'Enrollment is not available on this website yet.'}
      </p>
    </div>
  );
}
