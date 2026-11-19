import 'server-only';
import type { PrismaClient } from '../../../generated/prisma/client';
import { StudentError } from '../../student/errors';
import { enrollmentAccessWhere } from '../../lms/enrollment-access';
import { entitledStudentWhere } from '../../lms/entitlement';
import { lmsHref } from '../../platform/domains';
import { marketplaceImages } from '../types';
/** One joined page plus a single identity gate. No payment/webhook/onboarding data. */
export async function myPrograms(db: PrismaClient, userId: string, page = 1) {
  if (!Number.isInteger(page) || page < 1 || page > 10000)
    throw new StudentError('INVALID_INPUT');
  const [rows, allowed] = await Promise.all([
    db.marketplaceEntitlement.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 20,
      take: 21,
      select: {
        grantedAt: true,
        order: { select: { titleSnapshot: true, publicRef: true } },
        offering: {
          select: { slug: true, cardImage: true, publicationStatus: true },
        },
        delivery: {
          select: {
            status: true,
            type: true,
            courseId: true,
            course: {
              select: {
                published: true,
                enrollments: {
                  where: { userId, ...enrollmentAccessWhere() },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
    db.user.findFirst({
      where: entitledStudentWhere(userId),
      select: { id: true },
    }),
  ]);
  return {
    page,
    hasNext: rows.length > 20,
    items: rows.slice(0, 20).map((e) => {
      const d = e.delivery,
        canLearn =
          !!allowed &&
          d?.status === 'ACTIVE' &&
          d.course?.published &&
          !!d.course.enrollments.length;
      const state =
        d?.type === 'EXTERNAL' && d.status === 'NOT_REQUIRED'
          ? 'OWNED'
          : canLearn
            ? 'ACTIVE'
            : d && ['REVIEW', 'FAILED', 'ACTIVE'].includes(d.status)
              ? 'ATTENTION'
              : 'PREPARING';
      return {
        title: e.order.titleSnapshot,
        programPath:
          e.offering.publicationStatus === 'PUBLISHED'
            ? `/courses/${e.offering.slug}`
            : null,
        image:
          e.offering.cardImage &&
          marketplaceImages.some((p) => p === e.offering.cardImage)
            ? e.offering.cardImage
            : '/images/campus.webp',
        grantedAt: e.grantedAt.toISOString(),
        state,
        learningPath: canLearn
          ? lmsHref(`/learn/courses/${d!.courseId}`)
          : null,
        orderPath: `/orders/${e.order.publicRef}`,
      };
    }),
  };
}
export type MyPrograms = Awaited<ReturnType<typeof myPrograms>>;
export async function deliveryDetail(db: PrismaClient, entitlementId: string) {
  const row = await db.marketplaceDelivery.findUnique({
    where: { entitlementId },
    select: {
      publicRef: true,
      type: true,
      status: true,
      provenance: true,
      learnerIdentityProvenance: true,
      lmsAccessProvenance: true,
      attemptCount: true,
      lastAttemptAt: true,
      lastErrorCode: true,
      provisionedAt: true,
      revokedAt: true,
      course: { select: { title: true } },
      createdAt: true,
      updatedAt: true,
    },
  });
  return row
    ? {
        ref: row.publicRef,
        type: row.type,
        status: row.status,
        provenance: row.provenance,
        learnerIdentityProvenance: row.learnerIdentityProvenance,
        lmsAccessProvenance: row.lmsAccessProvenance,
        attemptCount: row.attemptCount,
        lastErrorCode: row.lastErrorCode,
        course: row.course?.title || null,
        lastAttemptAt: row.lastAttemptAt?.toISOString() || null,
        provisionedAt: row.provisionedAt?.toISOString() || null,
        revokedAt: row.revokedAt?.toISOString() || null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;
}
