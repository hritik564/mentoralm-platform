import type { Metadata } from 'next';
import { cache } from 'react';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ProgramPage } from '@/components/marketplace/program/ProgramPage';
import { programMetadata } from '@/components/marketplace/program/metadata';
import { Icon } from '@/components/ui/Icon';
import { getPublicProgram } from '@/lib/marketplace/program-public';
import { websiteHref } from '@/lib/platform/domains';
import '@/styles/marketplace.css';
import '@/styles/marketplace-program.css';

export const dynamic = 'force-dynamic';

type ProgramRouteProps = { params: Promise<{ slug: string }> };

const readProgram = cache(async (slug: string) => {
  // Both metadata and page rendering remain provider-free during a safe build.
  await connection();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) notFound();
  const result = await getPublicProgram(slug);
  if (result.status === 'ready' && !result.program) notFound();
  return result;
});

export async function generateMetadata({
  params,
}: ProgramRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await readProgram(slug);
  if (result.status === 'unavailable')
    return {
      title: 'Program details unavailable',
      description: 'Program details are temporarily unavailable.',
      robots: { index: false, follow: false },
      alternates: { canonical: null },
      openGraph: {
        title: 'Program details unavailable | MentoraLM',
        description: 'Program details are temporarily unavailable.',
        url: null,
      },
      twitter: {
        card: 'summary',
        title: 'Program details unavailable | MentoraLM',
        description: 'Program details are temporarily unavailable.',
      },
    };
  if (!result.program) notFound();
  return programMetadata(result.program);
}

export default async function PublicProgramRoute({
  params,
}: ProgramRouteProps) {
  const { slug } = await params;
  const result = await readProgram(slug);
  const homeHref = websiteHref('/');
  return (
    <div className="marketplace-page program-shell" id="top">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar homeHref={homeHref} />
      {result.status === 'unavailable' ? (
        <main id="main-content" className="marketplace program-unavailable">
          <div className="container">
            <div className="program-unavailable-panel" role="status">
              <span className="program-unavailable-icon">
                <Icon name="spark" />
              </span>
              <h1>Program details are temporarily unavailable</h1>
              <p>Please try again shortly to explore this program.</p>
              <a
                className="program-catalogue-link"
                href={websiteHref('/courses')}
              >
                Explore all courses <Icon name="arrow" />
              </a>
            </div>
          </div>
        </main>
      ) : result.program ? (
        <ProgramPage program={result.program} />
      ) : null}
      <Footer homeHref={homeHref} />
    </div>
  );
}
