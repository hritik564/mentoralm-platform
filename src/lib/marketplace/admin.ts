import 'server-only';
import { randomUUID } from 'node:crypto';
import type {
  MarketplaceOffering,
  Prisma,
} from '../../generated/prisma/client';
import { AcademicCore } from '../admin/academic/core';
import { adminHandle, adminId } from '../admin/handles';
import { parseInput } from '../admin/validation';
import { StudentError } from '../student/errors';
import { safeMarketplaceImage } from './images';
import {
  createOfferingInput,
  marketplaceListInput,
  offeringRevisionInput,
  updateOfferingInput,
} from './validation';
import type { AdminOffering, AdminOfferingList, OfferingInput } from './types';

export function adminOffering(row: MarketplaceOffering): AdminOffering {
  return {
    ref: adminHandle('offering', row.id),
    revision: row.revision,
    title: row.title,
    slug: row.slug,
    shortDescription: row.shortDescription,
    category: row.category,
    cardImage: row.cardImage,
    heroImage: row.heroImage,
    deliveryMode: row.deliveryMode,
    durationLabel: row.durationLabel,
    priceMinor: row.priceMinor,
    currency: row.currency,
    availabilityStatus: row.availabilityStatus,
    publicationStatus: row.publicationStatus,
    featured: row.featured,
    sortOrder: row.sortOrder,
    lmsEnabled: row.lmsEnabled,
    courseRef: row.courseId ? adminHandle('course', row.courseId) : null,
    cohortStartsAt: row.cohortStartsAt?.toISOString() || null,
    publishedAt: row.publishedAt?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
async function imageInputs(
  input: Pick<OfferingInput, 'cardImage' | 'heroImage'>,
) {
  for (const image of [input.cardImage, input.heroImage])
    if (image && !(await safeMarketplaceImage(image)))
      throw new StudentError('INVALID_INPUT');
}
function validatePublished(input: {
  shortDescription: string;
  category: string;
  durationLabel: string;
  lmsEnabled: boolean;
  courseId: string | null;
}) {
  if (
    !input.shortDescription.trim() ||
    !input.category.trim() ||
    !input.durationLabel.trim() ||
    (input.lmsEnabled && !input.courseId)
  )
    throw new StudentError('INVALID_INPUT');
}
function auditDetails(
  before: MarketplaceOffering | null,
  after: MarketplaceOffering,
  changedFields: string[],
): Prisma.InputJsonObject {
  return {
    offeringId: after.id,
    slug: after.slug,
    publicationBefore: before?.publicationStatus || null,
    publicationAfter: after.publicationStatus,
    availabilityBefore: before?.availabilityStatus || null,
    availabilityAfter: after.availabilityStatus,
    lmsEnabled: after.lmsEnabled,
    courseId: after.courseId,
    changedFields,
  };
}

/** Catalogue operations use their dedicated capability and transactional audit. */
export class AdminMarketplace extends AcademicCore {
  override async authorize() {
    await super.authorize('MARKETPLACE_MANAGE');
  }
  async list(
    query: Record<string, string | undefined> = {},
  ): Promise<AdminOfferingList> {
    await this.authorize();
    const p = parseInput(marketplaceListInput, query);
    const where: Prisma.MarketplaceOfferingWhereInput = {
      ...(p.q
        ? {
            OR: [
              { title: { contains: p.q, mode: 'insensitive' } },
              { slug: { contains: p.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(p.status ? { publicationStatus: p.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.marketplaceOffering.findMany({
        where,
        skip: (p.page - 1) * 20,
        take: 20,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      }),
      this.db.marketplaceOffering.count({ where }),
    ]);
    return { page: p.page, total, rows: rows.map(adminOffering) };
  }
  async detail(id: string): Promise<AdminOffering> {
    await this.authorize();
    const row = await this.db.marketplaceOffering.findUnique({ where: { id } });
    if (!row) throw new StudentError('NOT_FOUND');
    return adminOffering(row);
  }
  async courses(query: Record<string, string | undefined> = {}) {
    await this.authorize();
    const p = parseInput(marketplaceListInput.pick({ q: true }), query);
    const rows = await this.db.course.findMany({
      where: { title: { contains: p.q, mode: 'insensitive' } },
      select: { id: true, title: true },
      take: 50,
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      ref: adminHandle('course', row.id),
      label: row.title,
    }));
  }
  async save(id: string | null, input: unknown): Promise<string> {
    await this.authorize();
    const parsed = id
      ? parseInput(updateOfferingInput, input)
      : parseInput(createOfferingInput, input);
    await imageInputs(parsed);
    const { courseRef, cohortStartsAt, ...fields } = parsed;
    const revision = 'revision' in fields ? String(fields.revision) : null;
    const data = {
      title: fields.title,
      slug: fields.slug,
      shortDescription: fields.shortDescription,
      category: fields.category,
      cardImage: fields.cardImage,
      heroImage: fields.heroImage,
      deliveryMode: fields.deliveryMode,
      durationLabel: fields.durationLabel,
      priceMinor: fields.priceMinor,
      currency: fields.currency,
      availabilityStatus: fields.availabilityStatus,
      featured: fields.featured,
      sortOrder: fields.sortOrder,
      lmsEnabled: fields.lmsEnabled,
      courseId: courseRef ? adminId('course', courseRef) : null,
      cohortStartsAt: cohortStartsAt ? new Date(cohortStartsAt) : null,
    };
    if (!data.lmsEnabled && data.courseId)
      throw new StudentError('INVALID_INPUT');
    try {
      return await this.write(
        id ? 'MarketplaceOfferingUpdated' : 'MarketplaceOfferingCreated',
        async (tx) => {
          const before = id
            ? await tx.marketplaceOffering.findUnique({ where: { id } })
            : null;
          if (id && !before) throw new StudentError('NOT_FOUND');
          if (
            before &&
            (before.revision !== revision ||
              before.publicationStatus === 'ARCHIVED')
          )
            throw new StudentError('CONFLICT');
          const duplicate = await tx.marketplaceOffering.findUnique({
            where: { slug: data.slug },
            select: { id: true },
          });
          if (duplicate && duplicate.id !== id)
            throw new StudentError('CONFLICT');
          if (
            data.courseId &&
            !(await tx.course.findUnique({
              where: { id: data.courseId },
              select: { id: true },
            }))
          )
            throw new StudentError('NOT_FOUND');
          if (before?.publicationStatus === 'PUBLISHED')
            validatePublished(data);
          const nextRevision = randomUUID();
          let after: MarketplaceOffering;
          if (id) {
            const result = await tx.marketplaceOffering.updateMany({
              where: { id, revision: revision! },
              data: { ...data, revision: nextRevision },
            });
            if (result.count !== 1) throw new StudentError('CONFLICT');
            after = (await tx.marketplaceOffering.findUnique({
              where: { id },
            }))!;
          } else
            after = await tx.marketplaceOffering.create({
              data: {
                ...data,
                revision: nextRevision,
                publicationStatus: 'DRAFT',
              },
            });
          const changedFields = Object.keys(data).filter((key) => {
            if (!before) return true;
            const field = key as keyof typeof data;
            const old = before[field],
              value = data[field];
            return old instanceof Date || value instanceof Date
              ? (old instanceof Date ? old.toISOString() : old) !==
                  (value instanceof Date ? value.toISOString() : value)
              : old !== value;
          });
          return {
            value: after.id,
            targetId: after.id,
            details: auditDetails(before, after, changedFields),
          };
        },
      );
    } catch (error) {
      return conflict(error);
    }
  }
  private async transition(
    id: string,
    input: unknown,
    action: 'Published' | 'Unpublished' | 'Archived',
  ): Promise<string> {
    await this.authorize();
    const { revision } = parseInput(offeringRevisionInput, input);
    try {
      return await this.write(`MarketplaceOffering${action}`, async (tx) => {
        const before = await tx.marketplaceOffering.findUnique({
          where: { id },
        });
        if (!before) throw new StudentError('NOT_FOUND');
        if (
          before.revision !== revision ||
          before.publicationStatus === 'ARCHIVED' ||
          (action === 'Published' &&
            before.publicationStatus === 'PUBLISHED') ||
          (action === 'Unpublished' && before.publicationStatus !== 'PUBLISHED')
        )
          throw new StudentError('CONFLICT');
        if (action === 'Published') {
          validatePublished(before);
          await imageInputs(before);
          if (
            before.courseId &&
            !(await tx.course.findUnique({
              where: { id: before.courseId },
              select: { id: true },
            }))
          )
            throw new StudentError('NOT_FOUND');
        }
        const publicationStatus =
          action === 'Published'
            ? 'PUBLISHED'
            : action === 'Unpublished'
              ? 'UNPUBLISHED'
              : 'ARCHIVED';
        const result = await tx.marketplaceOffering.updateMany({
          where: { id, revision },
          data: {
            publicationStatus,
            revision: randomUUID(),
            ...(action === 'Published' ? { publishedAt: new Date() } : {}),
          },
        });
        if (result.count !== 1) throw new StudentError('CONFLICT');
        const after = (await tx.marketplaceOffering.findUnique({
          where: { id },
        }))!;
        return {
          value: id,
          targetId: id,
          details: auditDetails(before, after, [
            'publicationStatus',
            ...(action === 'Published' ? ['publishedAt'] : []),
          ]),
        };
      });
    } catch (error) {
      return conflict(error);
    }
  }
  publish(id: string, input: unknown) {
    return this.transition(id, input, 'Published');
  }
  unpublish(id: string, input: unknown) {
    return this.transition(id, input, 'Unpublished');
  }
  archive(id: string, input: unknown) {
    return this.transition(id, input, 'Archived');
  }
}
