import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { NoticeButton } from '@/components/ui/NoticeButton';
import type { PublicOffering } from '@/lib/marketplace/types';

const availabilityLabels = {
  OPEN: 'Open',
  COMING_SOON: 'Coming soon',
  WAITLIST: 'Waitlist',
  CLOSED: 'Closed',
} as const;
const deliveryLabels = {
  ONLINE: 'Online',
  OFFLINE: 'In person',
  HYBRID: 'Hybrid',
} as const;

function priceLabel(offering: PublicOffering) {
  if (offering.priceMinor === null) return 'To be announced';
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: offering.currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(offering.priceMinor / 10 ** digits);
}

function FallbackArtwork() {
  return (
    <div className="marketplace-card-fallback" aria-hidden="true">
      <span className="marketplace-fallback-brand">
        MentoraLM <span>Learning, with possibility.</span>
      </span>
      <svg
        className="marketplace-fallback-orbits"
        viewBox="0 0 480 280"
        fill="none"
      >
        <ellipse
          cx="360"
          cy="185"
          rx="145"
          ry="75"
          transform="rotate(-27 360 185)"
        />
        <ellipse
          cx="360"
          cy="185"
          rx="115"
          ry="58"
          transform="rotate(-27 360 185)"
        />
        <ellipse
          cx="360"
          cy="185"
          rx="83"
          ry="41"
          transform="rotate(-27 360 185)"
        />
        <path d="M40 245 440 45M110 280 480 95M0 190 380 0" />
        <circle cx="270" cy="200" r="6" />
        <circle cx="407" cy="126" r="4" />
      </svg>
      <span className="marketplace-fallback-spark">
        <Icon name="spark" />
      </span>
      <span className="marketplace-fallback-caption">
        A new direction starts here.
      </span>
    </div>
  );
}

export function MarketplaceCard({
  offering,
  headingLevel = 3,
}: {
  offering: PublicOffering;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const titleId = `marketplace-offering-${offering.slug}`;
  return (
    <article className="marketplace-card" aria-labelledby={titleId}>
      <div className="marketplace-card-media">
        {offering.cardImage ? (
          <Image
            src={offering.cardImage}
            alt={`${offering.title} program illustration`}
            fill
            sizes="(max-width: 640px) 94vw, (max-width: 1024px) 46vw, 31vw"
          />
        ) : (
          <FallbackArtwork />
        )}
        <span
          className={`marketplace-availability is-${offering.availabilityStatus.toLowerCase()}`}
        >
          {availabilityLabels[offering.availabilityStatus]}
        </span>
      </div>
      <div className="marketplace-card-body">
        <p className="marketplace-card-category">{offering.category}</p>
        <Heading className="marketplace-card-title" id={titleId}>
          {offering.title}
        </Heading>
        <p className="marketplace-card-description">
          {offering.shortDescription}
        </p>
        <dl className="marketplace-card-facts">
          <div>
            <dt>Duration</dt>
            <dd>{offering.durationLabel || 'To be announced'}</dd>
          </div>
          <div>
            <dt>Learning mode</dt>
            <dd>{deliveryLabels[offering.deliveryMode]}</dd>
          </div>
          {offering.cohortStartsAt && (
            <div className="marketplace-card-start">
              <dt>Starts</dt>
              <dd>
                <time dateTime={offering.cohortStartsAt}>
                  {new Date(offering.cohortStartsAt).toLocaleDateString(
                    'en-IN',
                    {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'UTC',
                    },
                  )}
                </time>
              </dd>
            </div>
          )}
        </dl>
        <div className="marketplace-card-footer">
          <div className="marketplace-card-price">
            <span>Program fee</span>
            <strong>{priceLabel(offering)}</strong>
          </div>
          <NoticeButton
            className="marketplace-card-action"
            title={offering.title}
            description={`${offering.shortDescription} Full program details and enrollment options will be shared in a future update. No application or payment is collected here.`}
            arrow
          >
            Details Coming Soon
          </NoticeButton>
        </div>
      </div>
    </article>
  );
}
