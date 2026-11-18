import { Pill } from '../Primitives';
import { marketplaceLabel } from './format';
import type { AvailabilityStatus, PublicationStatus } from './types';

export function MarketplaceStatusBadge({
  value,
}: {
  value: AvailabilityStatus | PublicationStatus;
}) {
  return (
    <Pill tone={value === 'PUBLISHED' || value === 'OPEN' ? 'good' : 'neutral'}>
      {marketplaceLabel(value)}
    </Pill>
  );
}
