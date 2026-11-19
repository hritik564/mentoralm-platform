import type { Metadata } from 'next';
import type { PublicProgram } from '@/lib/marketplace/page-types';

/** Only an already-published public DTO enters this metadata projection. */
export function programMetadata(program: PublicProgram): Metadata {
  const title = program.page.seoTitle || `${program.title} | MentoraLM`;
  const description =
    program.page.seoDescription ||
    program.page.heroSummary ||
    program.shortDescription;
  const canonical = `/courses/${program.slug}`;
  const image = program.heroImage || program.cardImage;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      ...(image
        ? { images: [{ url: image, alt: `${program.title} program visual` }] }
        : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
