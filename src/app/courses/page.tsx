import type { Metadata } from 'next';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/layout/Footer';
import { MarketplaceGrid } from '@/components/marketplace/MarketplaceGrid';
import { MarketplaceEmptyState } from '@/components/marketplace/MarketplaceEmptyState';
import { getPublicOfferings } from '@/lib/marketplace/public';
import { websiteHref } from '@/lib/platform/domains';
import '@/styles/marketplace.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Courses & Programs',
  alternates: { canonical: '/courses' },
  openGraph: {
    type: 'website',
    title: 'Courses & Programs | MentoraLM',
    description:
      'Discover career, technology and professional courses and programs from MentoraLM.',
    url: '/courses',
  },
  description:
    'Discover career, technology and professional courses and programs from MentoraLM.',
};
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const search = await searchParams;
  const requestedPage = Number(search.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 1;
  const catalogue = await getPublicOfferings({ page, limit: 20 });
  const homeHref = websiteHref('/');
  return (
    <div className="marketplace-page" id="top">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar homeHref={homeHref} />
      <main id="main-content" className="marketplace marketplace-catalogue">
        <div className="container">
          <header className="marketplace-catalogue-heading">
            <p className="marketplace-eyebrow">The MentoraLM catalogue</p>
            <h1>
              Courses &amp; <span>Programs</span>
            </h1>
            <p>
              Discover career, technology and professional programs designed to
              help you move forward with clarity and confidence.
            </p>
          </header>
          {catalogue.status === 'unavailable' ? (
            <MarketplaceEmptyState unavailable headingLevel={2} />
          ) : (
            <>
              {catalogue.offerings.length ? (
                <MarketplaceGrid
                  offerings={catalogue.offerings}
                  headingLevel={2}
                />
              ) : (
                <MarketplaceEmptyState headingLevel={2} />
              )}
              {(catalogue.total > 20 || catalogue.page > 1) && (
                <nav
                  className="marketplace-pagination"
                  aria-label="Course pages"
                >
                  {catalogue.page > 1 ? (
                    <a
                      href={`${websiteHref('/courses')}?page=${catalogue.page - 1}`}
                    >
                      Previous page
                    </a>
                  ) : (
                    <span>Previous page</span>
                  )}
                  <span aria-current="page">Page {catalogue.page}</span>
                  {catalogue.page * 20 < catalogue.total ? (
                    <a
                      href={`${websiteHref('/courses')}?page=${catalogue.page + 1}`}
                    >
                      Next page
                    </a>
                  ) : (
                    <span>Next page</span>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </main>
      <Footer homeHref={homeHref} />
    </div>
  );
}
