import { marketplaceDiagnostic } from '../diagnostics';
import 'server-only';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client';
import { StudentError } from '../../student/errors';
import { requireAdminPermission } from '../../auth/admin-policy';
import { ensureMarketplaceLearner } from './learner';
import {
  commerceTransaction,
  purchaseLock,
  commerceAudit,
  revised,
} from '../commerce/core';
import { initializeDelivery } from './state';
const include = {
  entitlement: {
    include: {
      order: { select: { intentId: true } },
      user: { select: { id: true, role: true, studentId: true } },
      offering: { select: { courseId: true, lmsEnabled: true } },
    },
  },
} as const;
type Authority =
  | { ownerId: string; adminActorId?: never }
  | { adminActorId: string; ownerId?: never };
export class MarketplaceDeliveryService {
  constructor(
    private db: PrismaClient,
    private now: () => Date = () => new Date(),
    private beforeProvision: () => Promise<void> = async () => {},
  ) {}
  private async authority(
    tx: Prisma.TransactionClient,
    userId: string,
    authority: Authority,
  ) {
    if (authority.adminActorId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(19748962,4)`;
      await requireAdminPermission(tx, authority.adminActorId, 'COMMERCE_VIEW');
      await requireAdminPermission(
        tx,
        authority.adminActorId,
        'DELIVERY_MANAGE',
      );
    } else if (authority.ownerId !== userId)
      throw new StudentError('NOT_FOUND');
  }
  async ensure(entitlementId: string, authority: Authority) {
    return commerceTransaction(this.db, async (tx) => {
      const e = await tx.marketplaceEntitlement.findUnique({
        where: { id: entitlementId },
        select: { userId: true, offeringId: true },
      });
      if (!e) throw new StudentError('NOT_FOUND');
      await this.authority(tx, e.userId, authority);
      await purchaseLock(tx, e.userId, e.offeringId);
      return initializeDelivery(tx, entitlementId);
    });
  }
  async run(ref: string, authority: Authority, manual = false) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ref)) throw new StudentError('NOT_FOUND');
    const claim = await commerceTransaction(this.db, async (tx) => {
      const d = await tx.marketplaceDelivery.findUnique({
        where: { publicRef: ref },
        include,
      });
      if (!d) throw new StudentError('NOT_FOUND');
      const e = d.entitlement;
      await this.authority(tx, e.userId, authority);
      await purchaseLock(tx, e.userId, e.offeringId);
      const audit = async (
        kind:
          | 'MarketplaceDeliveryRevoked'
          | 'MarketplaceDeliveryProvisioningStarted',
      ) =>
        commerceAudit(
          tx,
          e.order.intentId,
          e.orderId,
          kind,
          authority.adminActorId || null,
        );
      if (e.status !== 'ACTIVE') {
        if (d.status !== 'REVOKED') {
          await tx.marketplaceDelivery.update({
            where: { id: d.id },
            data: {
              status: 'REVOKED',
              revokedAt: this.now(),
              lastErrorCode: null,
              ...revised(),
            },
          });
          await audit('MarketplaceDeliveryRevoked');
        }
        return null;
      }
      if (['ACTIVE', 'NOT_REQUIRED', 'REVOKED'].includes(d.status)) return null;
      if (d.status === 'REVIEW' && !(manual && authority.adminActorId))
        return null;
      const age = this.now().getTime() - (d.lastAttemptAt?.getTime() || 0);
      if (d.status === 'PROVISIONING' && age < 10 * 60000) return null;
      if (d.status === 'PROVISIONING')
        marketplaceDiagnostic('MARKETPLACE_LEASE_STALE');
      if (d.status === 'PROVISIONING' && d.attemptCount >= 3 && !manual) {
        await tx.marketplaceDelivery.update({
          where: { id: d.id },
          data: {
            status: 'REVIEW',
            lastErrorCode: 'RETRY_LIMIT',
            ...revised(),
          },
        });
        await commerceAudit(
          tx,
          e.order.intentId,
          e.orderId,
          'MarketplaceDeliveryProvisioningFailed',
          authority.adminActorId || null,
          'RETRY_LIMIT',
        );
        return null;
      }

      if (
        d.status === 'FAILED' &&
        !manual &&
        (age < 5 * 60000 || d.attemptCount >= 3)
      )
        return null;
      if (d.status === 'REVOKE_PENDING') return null;
      const next = await tx.marketplaceDelivery.update({
        where: { id: d.id },
        data: {
          status: 'PROVISIONING',
          attemptCount: { increment: 1 },
          lastAttemptAt: this.now(),
          lastErrorCode: null,
          ...revised(),
        },
      });
      await audit('MarketplaceDeliveryProvisioningStarted');
      return next;
    });
    if (!claim) return;
    try {
      await this.beforeProvision();
      const outcome = await commerceTransaction(this.db, async (tx) => {
        const d = await tx.marketplaceDelivery.findUniqueOrThrow({
          where: { id: claim.id },
          include,
        });
        const e = d.entitlement;
        await this.authority(tx, e.userId, authority);
        await purchaseLock(tx, e.userId, e.offeringId);
        if (d.revision !== claim.revision || d.status !== 'PROVISIONING')
          return;
        const actorId = authority.adminActorId || null;
        const audit = (
          kind:
            | 'MarketplaceDeliveryProvisioned'
            | 'MarketplaceDeliveryProvisioningFailed'
            | 'MarketplaceDeliveryReusedEnrollment'
            | 'MarketplaceDeliveryRevoked',
          code: string | null = null,
        ) =>
          commerceAudit(tx, e.order.intentId, e.orderId, kind, actorId, code);
        if (e.status !== 'ACTIVE') {
          await tx.marketplaceDelivery.update({
            where: { id: d.id },
            data: { status: 'REVOKED', revokedAt: this.now(), ...revised() },
          });
          await audit('MarketplaceDeliveryRevoked');
          return;
        }
        const review = async (code: string) => {
          await tx.marketplaceDelivery.update({
            where: { id: d.id },
            data: { status: 'REVIEW', lastErrorCode: code, ...revised() },
          });
          await audit('MarketplaceDeliveryProvisioningFailed', code);
          return 'REVIEW' as const;
        };
        if (d.type === 'EXTERNAL') {
          await tx.marketplaceDelivery.update({
            where: { id: d.id },
            data: { status: 'NOT_REQUIRED', ...revised() },
          });
          return;
        }
        // Only an explicit authorized retry may resolve a previously missing target.
        const courseId =
          d.courseId ||
          (manual && authority.adminActorId ? e.offering.courseId : null);
        if (!courseId) {
          return review('COURSE_CONFIGURATION');
        }
        const course = await tx.course.findUnique({
          where: { id: courseId },
          select: {
            id: true,
            published: true,
            requiredAttendancePercent: true,
          },
        });
        if (!course?.published) {
          return review('COURSE_UNAVAILABLE');
        }
        if (
          course.requiredAttendancePercent !== null &&
          !(await tx.batchMembership.findFirst({
            where: {
              userId: e.userId,
              status: 'ACTIVE',
              joinedAt: { lte: this.now() },
              OR: [{ leftAt: null }, { leftAt: { gt: this.now() } }],
              batch: {
                status: 'ACTIVE',
                AND: [
                  {
                    OR: [{ startsAt: null }, { startsAt: { lte: this.now() } }],
                  },
                  { OR: [{ endsAt: null }, { endsAt: { gte: this.now() } }] },
                ],
                OR: [
                  { courseId },
                  {
                    courseId: null,
                    program: { courses: { some: { id: courseId } } },
                  },
                ],
              },
            },
            select: { id: true },
          }))
        ) {
          return review('BATCH_REQUIRED');
        }
        const learner = await ensureMarketplaceLearner(
          tx,
          d,
          actorId,
          this.now(),
        );
        if (!learner) {
          return review('LMS_ACCESS_DISABLED');
        }
        // Serializes different Offerings that resolve to the same User/Course.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`marketplace-enrollment:${e.userId}:${courseId}`},0))::text`;
        let enrollment = await tx.enrollment.findUnique({
          where: { userId_courseId: { userId: e.userId, courseId } },
        });
        const created = !enrollment;
        if (!enrollment)
          enrollment = await tx.enrollment.create({
            data: { userId: e.userId, courseId },
          });
        await tx.marketplaceDelivery.update({
          where: { id: d.id },
          data: {
            ...learner,
            courseId,
            enrollmentId: enrollment.id,
            createdEnrollmentId: created ? enrollment.id : null,
            provenance: created ? 'CREATED' : 'REUSED',
            status: 'ACTIVE',
            provisionedAt: this.now(),
            lastErrorCode: null,
            ...revised(),
          },
        });
        if (!created) await audit('MarketplaceDeliveryReusedEnrollment');
        await audit('MarketplaceDeliveryProvisioned');
      });
      if (outcome === 'REVIEW')
        marketplaceDiagnostic('MARKETPLACE_DELIVERY_REVIEW');
    } catch {
      // Financial settlement and ownership are never in this transaction.
      const failed = await commerceTransaction(this.db, async (tx) => {
        const d = await tx.marketplaceDelivery.findUniqueOrThrow({
          where: { id: claim.id },
          include,
        });
        await this.authority(tx, d.entitlement.userId, authority);
        await purchaseLock(tx, d.entitlement.userId, d.entitlement.offeringId);
        if (d.status !== 'PROVISIONING' || d.revision !== claim.revision)
          return;
        await tx.marketplaceDelivery.update({
          where: { id: d.id },
          data: {
            status: 'FAILED',
            lastErrorCode: 'PROVISIONING_UNAVAILABLE',
            ...revised(),
          },
        });
        await commerceAudit(
          tx,
          d.entitlement.order.intentId,
          d.entitlement.orderId,
          'MarketplaceDeliveryProvisioningFailed',
          authority.adminActorId || null,
          'PROVISIONING_UNAVAILABLE',
        );
        return true;
      });
      if (failed) marketplaceDiagnostic('MARKETPLACE_DELIVERY_FAILED');
    }
  }
  async reconcile(authority: Authority, limit = 5) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new StudentError('INVALID_INPUT');
    if (authority.adminActorId) {
      await requireAdminPermission(
        this.db,
        authority.adminActorId,
        'COMMERCE_VIEW',
      );
      await requireAdminPermission(
        this.db,
        authority.adminActorId,
        'DELIVERY_MANAGE',
      );
    }
    const now = this.now(),
      stale = new Date(now.getTime() - 10 * 60000),
      retry = new Date(now.getTime() - 5 * 60000);
    const rows = await this.db.marketplaceEntitlement.findMany({
      where: {
        ...(authority.ownerId ? { userId: authority.ownerId } : {}),
        OR: [
          { delivery: null },
          {
            status: { not: 'ACTIVE' },
            delivery: { status: { not: 'REVOKED' } },
          },
          {
            status: 'ACTIVE',
            delivery: {
              OR: [
                { status: 'PENDING' },
                { status: 'PROVISIONING', lastAttemptAt: { lte: stale } },
                {
                  status: 'FAILED',
                  attemptCount: { lt: 3 },
                  lastAttemptAt: { lte: retry },
                },
              ],
            },
          },
        ],
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true },
    });
    let checked = 0,
      errors = 0;
    for (const row of rows) {
      try {
        const d = await this.ensure(row.id, authority);
        await this.run(d.publicRef, authority);
        checked++;
      } catch {
        errors++;
      }
    }
    return { examined: rows.length, checked, errors };
  }
}
