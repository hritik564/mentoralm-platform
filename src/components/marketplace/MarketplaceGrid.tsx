import type { PublicOffering } from '@/lib/marketplace/types';
import { MarketplaceCard } from './MarketplaceCard';
export function MarketplaceGrid({
  offerings,
  headingLevel = 3,
}: {
  offerings: readonly PublicOffering[];
  headingLevel?: 2 | 3;
}) {
  return (
    <div className="marketplace-grid">
      {offerings.map((offering) => (
        <MarketplaceCard
          key={offering.slug}
          offering={offering}
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}
