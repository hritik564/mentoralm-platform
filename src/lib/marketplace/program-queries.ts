import 'server-only';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { publicOfferingSelect, toPublicOffering } from './offering-projection';
import {
  programPageSnapshotInput,
  programSectionHasContent,
  publicProgramSlugInput,
} from './page-validation';
import type { PublicProgram, PublicProgramSection } from './page-types';

// Draft fields and draft section rows never enter the public query at all.
const programSelect = {
  ...publicOfferingSelect,
  page: {
    select: {
      publishedVersion: { select: { snapshotJson: true } },
    },
  },
} as const satisfies Prisma.MarketplaceOfferingSelect;

/** Offering publication dominates; custom content requires explicit page publish. */
export async function readPublishedProgram(db: PrismaClient, slug: string) {
  if (!publicProgramSlugInput.safeParse(slug).success)
    return { status: 'ready' as const, program: null };
  const row = await db.marketplaceOffering.findFirst({
    where: { slug, publicationStatus: 'PUBLISHED' },
    select: programSelect,
  });
  if (!row) return { status: 'ready' as const, program: null };
  const emptySettings = {
    eyebrow: null,
    heroHeadline: null,
    heroSummary: null,
    seoTitle: null,
    seoDescription: null,
  };
  const snapshot = programPageSnapshotInput.safeParse(
    row.page?.publishedVersion?.snapshotJson,
  );
  const sections: PublicProgramSection[] = [];
  for (const stored of snapshot.success ? snapshot.data.sections : []) {
    if (!stored.enabled || !programSectionHasContent(stored)) continue;
    const { enabled, ...section } = stored;
    void enabled;
    sections.push(section);
  }
  const program: PublicProgram = {
    ...(await toPublicOffering(row)),
    page: {
      ...(snapshot.success ? snapshot.data.settings : emptySettings),
      sections,
    },
  };
  return { status: 'ready' as const, program };
}
