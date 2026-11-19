import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { AcademicCore, type TX } from '../admin/academic/core';
import { adminHandle, adminId } from '../admin/handles';
import { parseInput } from '../admin/validation';
import { StudentError } from '../student/errors';
import {
  MAX_PROGRAM_SECTIONS,
  createProgramSectionInput,
  pageSettingsInput,
  programPageSnapshotInput,
  canonicalProgramPageSnapshot,
  publishProgramPageInput,
  programSectionEnabledInput,
  programSectionInput,
  reorderProgramSectionsInput,
  updateProgramSectionInput,
} from './page-validation';
import type {
  AdminProgramPage,
  AdminProgramSection,
  ProgramPageSnapshot,
} from './page-types';

const pageInclude = {
  sections: { orderBy: { position: 'asc' }, take: MAX_PROGRAM_SECTIONS + 1 },
  publishedVersion: { select: { snapshotJson: true, publishedAt: true } },
} as const satisfies Prisma.MarketplaceOfferingPageInclude;
type PageRow = Prisma.MarketplaceOfferingPageGetPayload<{
  include: typeof pageInclude;
}>;
type SectionRow = PageRow['sections'][number];

function sectionDto(row: SectionRow): AdminProgramSection {
  const parsed = programSectionInput.safeParse({
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    enabled: row.enabled,
    content: row.contentJson,
  });
  if (!parsed.success) throw new StudentError('UNAVAILABLE');
  return {
    ...parsed.data,
    ref: adminHandle('offering-section', row.id),
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function draftSnapshot(page: PageRow | null): ProgramPageSnapshot {
  return parseInput(programPageSnapshotInput, {
    schemaVersion: 1,
    settings: {
      eyebrow: page?.eyebrow || null,
      heroHeadline: page?.heroHeadline || null,
      heroSummary: page?.heroSummary || null,
      seoTitle: page?.seoTitle || null,
      seoDescription: page?.seoDescription || null,
    },
    sections:
      page?.sections.map((section) => ({
        type: section.type,
        title: section.title,
        subtitle: section.subtitle,
        enabled: section.enabled,
        content: section.contentJson,
      })) || [],
  });
}
function hasDraftChanges(page: PageRow | null, draft: ProgramPageSnapshot) {
  const published = page?.publishedVersion
    ? programPageSnapshotInput.safeParse(page.publishedVersion.snapshotJson)
    : null;
  const comparison = published?.success ? published.data : draftSnapshot(null);
  return (
    canonicalProgramPageSnapshot(draft) !==
    canonicalProgramPageSnapshot(comparison)
  );
}
function pageDto(offeringId: string, page: PageRow | null): AdminProgramPage {
  if (page && page.sections.length > MAX_PROGRAM_SECTIONS)
    throw new StudentError('UNAVAILABLE');
  const draft = draftSnapshot(page);
  const changed = hasDraftChanges(page, draft);
  const publishedRevision = page?.publishedRevision || null;
  return {
    offeringRef: adminHandle('offering', offeringId),
    revision: page?.revision || null,
    ...draft.settings,
    publishedRevision,
    publishedAt: page?.publishedVersion?.publishedAt.toISOString() || null,
    hasDraftChanges: changed,
    editorialStatus: publishedRevision
      ? changed
        ? 'DRAFT_CHANGES_SINCE_PUBLISH'
        : 'PUBLISHED'
      : changed
        ? 'DRAFT_CHANGES'
        : 'NO_PUBLISHED_CONTENT',
    sections: page?.sections.map(sectionDto) || [],
  };
}
function conflict(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ['P2002', 'P2003', 'P2025', 'P2034'].includes(String(error.code))
  )
    throw new StudentError('CONFLICT');
  throw error;
}

/** One revision protects all optional page settings and sections. */
export class AdminMarketplacePages extends AcademicCore {
  override async authorize() {
    await super.authorize('MARKETPLACE_MANAGE');
  }

  async detail(offeringId: string): Promise<AdminProgramPage> {
    await this.authorize();
    const offering = await this.db.marketplaceOffering.findUnique({
      where: { id: offeringId },
      select: { page: { include: pageInclude } },
    });
    if (!offering) throw new StudentError('NOT_FOUND');
    return pageDto(offeringId, offering.page);
  }
  private async mutate(
    offeringId: string,
    revision: string | null,
    action: string,
    work: (tx: TX, page: PageRow) => Promise<Prisma.InputJsonObject>,
  ): Promise<AdminProgramPage> {
    try {
      return await this.write(action, async (tx) => {
        const offering = await tx.marketplaceOffering.findUnique({
          where: { id: offeringId },
          select: { publicationStatus: true },
        });
        if (!offering) throw new StudentError('NOT_FOUND');
        if (offering.publicationStatus === 'ARCHIVED')
          throw new StudentError('CONFLICT');
        let page = await tx.marketplaceOfferingPage.findUnique({
          where: { offeringId },
          include: pageInclude,
        });
        const nextRevision = randomUUID();
        if (page) {
          if (page.revision !== revision) throw new StudentError('CONFLICT');
          const changed = await tx.marketplaceOfferingPage.updateMany({
            where: { offeringId, revision: revision! },
            data: { revision: nextRevision },
          });
          if (changed.count !== 1) throw new StudentError('CONFLICT');
        } else {
          if (revision !== null) throw new StudentError('CONFLICT');
          page = await tx.marketplaceOfferingPage.create({
            data: { offeringId, revision: nextRevision },
            include: pageInclude,
          });
        }
        if (page.sections.length > MAX_PROGRAM_SECTIONS)
          throw new StudentError('CONFLICT');
        const details = await work(tx, page);
        const after = await tx.marketplaceOfferingPage.findUniqueOrThrow({
          where: { offeringId },
          include: pageInclude,
        });
        return {
          value: pageDto(offeringId, after),
          targetId: offeringId,
          details: {
            offeringId,
            sectionCount: after.sections.length,
            ...details,
          },
        };
      });
    } catch (error) {
      return conflict(error);
    }
  }
  async saveSettings(offeringId: string, input: unknown) {
    await this.authorize();
    const { revision, ...data } = parseInput(pageSettingsInput, input);
    return this.mutate(
      offeringId,
      revision,
      'MarketplacePageDraftUpdated',
      async (tx, page) => {
        await tx.marketplaceOfferingPage.update({
          where: { offeringId },
          data,
        });
        const changedFields = (
          Object.keys(data) as (keyof typeof data)[]
        ).filter((field) => page[field] !== data[field]);
        return { changedFields };
      },
    );
  }
  async createSection(offeringId: string, input: unknown) {
    await this.authorize();
    const { revision, content, ...fields } = parseInput(
      createProgramSectionInput,
      input,
    );
    return this.mutate(
      offeringId,
      revision,
      'MarketplaceSectionDraftCreated',
      async (tx, page) => {
        if (page.sections.length >= MAX_PROGRAM_SECTIONS)
          throw new StudentError('INVALID_INPUT');
        await tx.marketplaceOfferingSection.create({
          data: {
            ...fields,
            contentJson: content,
            pageId: offeringId,
            position: page.sections.length,
          },
        });
        return { sectionType: fields.type, enabled: fields.enabled };
      },
    );
  }
  async updateSection(offeringId: string, sectionId: string, input: unknown) {
    await this.authorize();
    const { revision, content, ...fields } = parseInput(
      updateProgramSectionInput,
      input,
    );
    return this.mutate(
      offeringId,
      revision,
      'MarketplaceSectionDraftUpdated',
      async (tx, page) => {
        if (!page.sections.some((section) => section.id === sectionId))
          throw new StudentError('NOT_FOUND');
        await tx.marketplaceOfferingSection.update({
          where: { id: sectionId },
          data: { ...fields, contentJson: content },
        });
        return {
          sectionType: fields.type,
          enabled: fields.enabled,
          changedFields: ['type', 'title', 'subtitle', 'enabled', 'content'],
        };
      },
    );
  }
  async setSectionEnabled(
    offeringId: string,
    sectionId: string,
    input: unknown,
  ) {
    await this.authorize();
    const { revision, enabled } = parseInput(programSectionEnabledInput, input);
    return this.mutate(
      offeringId,
      revision,
      'MarketplaceSectionDraftEnabledChanged',
      async (tx, page) => {
        const section = page.sections.find((row) => row.id === sectionId);
        if (!section) throw new StudentError('NOT_FOUND');
        await tx.marketplaceOfferingSection.update({
          where: { id: sectionId },
          data: { enabled },
        });
        return {
          sectionType: section.type,
          enabled,
          changedFields: ['enabled'],
        };
      },
    );
  }
  async reorderSections(offeringId: string, input: unknown) {
    await this.authorize();
    const { revision, sectionRefs } = parseInput(
      reorderProgramSectionsInput,
      input,
    );
    const ids = sectionRefs.map((ref) => adminId('offering-section', ref));
    return this.mutate(
      offeringId,
      revision,
      'MarketplaceSectionDraftReordered',
      async (tx, page) => {
        if (
          ids.length !== page.sections.length ||
          ids.some((id) => !page.sections.some((section) => section.id === id))
        )
          throw new StudentError('INVALID_INPUT');
        // Stage outside the final 0..19 range so the unique index never conflicts.
        for (let position = 0; position < ids.length; position++)
          await tx.marketplaceOfferingSection.update({
            where: { id: ids[position] },
            data: { position: position + MAX_PROGRAM_SECTIONS },
          });
        for (let position = 0; position < ids.length; position++)
          await tx.marketplaceOfferingSection.update({
            where: { id: ids[position] },
            data: { position },
          });
        return { changedFields: ['position'] };
      },
    );
  }
  async publishPage(
    offeringId: string,
    input: unknown,
  ): Promise<AdminProgramPage> {
    await this.authorize();
    const { revision } = parseInput(publishProgramPageInput, input);
    try {
      return await this.write('MarketplacePagePublished', async (tx) => {
        const offering = await tx.marketplaceOffering.findUnique({
          where: { id: offeringId },
          select: { publicationStatus: true },
        });
        if (!offering) throw new StudentError('NOT_FOUND');
        if (offering.publicationStatus === 'ARCHIVED')
          throw new StudentError('CONFLICT');
        const before = await tx.marketplaceOfferingPage.findUnique({
          where: { offeringId },
          include: pageInclude,
        });
        if (!before || before.revision !== revision)
          throw new StudentError('CONFLICT');
        const snapshot = draftSnapshot(before);
        if (!hasDraftChanges(before, snapshot))
          throw new StudentError('CONFLICT');
        await tx.marketplaceOfferingPageVersion.create({
          data: { pageId: offeringId, revision, snapshotJson: snapshot },
        });
        const promoted = await tx.marketplaceOfferingPage.updateMany({
          where: {
            offeringId,
            revision,
            publishedRevision: before.publishedRevision,
          },
          data: { publishedRevision: revision },
        });
        if (promoted.count !== 1) throw new StudentError('CONFLICT');
        const after = await tx.marketplaceOfferingPage.findUniqueOrThrow({
          where: { offeringId },
          include: pageInclude,
        });
        return {
          value: pageDto(offeringId, after),
          targetId: offeringId,
          details: {
            offeringId,
            sectionCount: snapshot.sections.length,
            published: true,
            versionRevision: revision,
            previousPublishedRevision: before.publishedRevision,
          },
        };
      });
    } catch (error) {
      return conflict(error);
    }
  }
}
