import { Suspense, type ReactNode } from 'react';
import { connection } from 'next/server';
import { getCachedPublicOfferings } from '@/lib/marketplace/public';
import { websiteHref } from '@/lib/platform/domains';
import { Icon } from '@/components/ui/Icon';
import { MarketplaceGrid } from './MarketplaceGrid';
import { MarketplaceEmptyState } from './MarketplaceEmptyState';
import '@/styles/marketplace.css';

export function MarketplacePreview() {
  return (
    <MarketplacePreviewFrame>
      <Suspense fallback={<MarketplacePreviewFallback />}>
        <MarketplacePreviewCards />
      </Suspense>
    </MarketplacePreviewFrame>
  );
}

async function MarketplacePreviewCards() {
  // Keep build-time rendering away from the database, including a cold cache.
  await connection();
  const catalogue = await getCachedPublicOfferings({
    featured: true,
    limit: 6,
  });
  return (
    <>
      {catalogue.status === 'unavailable' ? (
        <MarketplaceEmptyState unavailable />
      ) : catalogue.offerings.length ? (
        <MarketplaceGrid offerings={catalogue.offerings} />
      ) : (
        <MarketplaceEmptyState />
      )}
    </>
  );
}

function MarketplacePreviewFallback() {
  return (
    <div className="marketplace-empty" role="status">
      <p>Explore the full course catalogue for current programs.</p>
    </div>
  );
}

function MarketplacePreviewFrame({ children }: { children: ReactNode }) {
  return (
    <section
      id="programs"
      className="marketplace marketplace-preview"
      aria-labelledby="marketplace-preview-heading"
    >
      <div className="container">
        <header className="marketplace-section-heading">
          <div>
            <p className="marketplace-eyebrow">Learning for what comes next</p>
            <h2 id="marketplace-preview-heading">
              Explore MentoraLM
              <br />
              <span>Courses &amp; Programs</span>
            </h2>
            <p>
              Discover career, technology and professional programs designed to
              help you move forward with clarity and confidence.
            </p>
          </div>
          <a className="marketplace-explore" href={websiteHref('/courses')}>
            Explore All Courses <Icon name="arrow" />
          </a>
        </header>
        {children}
      </div>
    </section>
  );
}
