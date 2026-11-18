import { Icon } from '@/components/ui/Icon';
import { websiteHref } from '@/lib/platform/domains';
export function MarketplaceEmptyState({
  unavailable = false,
  headingLevel = 3,
}: {
  unavailable?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div
      className="marketplace-empty"
      role={unavailable ? 'status' : undefined}
    >
      <span className="marketplace-empty-icon">
        <Icon name="spark" />
      </span>
      <Heading>
        {unavailable
          ? 'Courses are temporarily unavailable'
          : 'Your next chapter is taking shape'}
      </Heading>
      <p>
        {unavailable
          ? "We couldn't load the catalogue right now. Please try again shortly."
          : 'New courses and programs from MentoraLM will appear here. Check back to find your next learning opportunity.'}
      </p>
      {unavailable && (
        <a className="marketplace-text-link" href={websiteHref('/courses')}>
          Try again <Icon name="arrow" />
        </a>
      )}
    </div>
  );
}
