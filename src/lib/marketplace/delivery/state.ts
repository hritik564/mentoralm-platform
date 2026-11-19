import 'server-only';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client';
import { commerceAudit, revised } from '../commerce/core';
/** Durable outbox only. No learning work or prerequisite validation in financial settlement. */
export async function initializeDelivery(
  tx: Prisma.TransactionClient,
  entitlementId: string,
) {
  const existing = await tx.marketplaceDelivery.findUnique({
    where: { entitlementId },
  });
  if (existing) return existing;
  const entitlement = await tx.marketplaceEntitlement.findUniqueOrThrow({
    where: { id: entitlementId },
    include: {
      offering: { select: { lmsEnabled: true, courseId: true } },
      order: { select: { intentId: true } },
    },
  });
  const row = await tx.marketplaceDelivery.create({
    data: {
      publicRef: randomBytes(32).toString('base64url'),
      entitlementId,
      type: entitlement.offering.lmsEnabled ? 'LMS' : 'EXTERNAL',
      status:
        entitlement.status !== 'ACTIVE'
          ? 'REVOKE_PENDING'
          : entitlement.offering.lmsEnabled
            ? 'PENDING'
            : 'NOT_REQUIRED',
      courseId: entitlement.offering.lmsEnabled
        ? entitlement.offering.courseId
        : null,
    },
  });
  await commerceAudit(
    tx,
    entitlement.order.intentId,
    entitlement.orderId,
    'MarketplaceDeliveryCreated',
  );
  return row;
}
export async function requestDeliveryRevocation(
  tx: Prisma.TransactionClient,
  entitlementId: string,
) {
  const row = await tx.marketplaceDelivery.findUnique({
    where: { entitlementId },
    include: {
      entitlement: { include: { order: { select: { intentId: true } } } },
    },
  });
  if (!row || ['REVOKED', 'REVOKE_PENDING'].includes(row.status)) return;
  await tx.marketplaceDelivery.update({
    where: { id: row.id },
    data: { status: 'REVOKE_PENDING', ...revised() },
  });
  await commerceAudit(
    tx,
    row.entitlement.order.intentId,
    row.entitlement.orderId,
    'MarketplaceDeliveryRevocationStarted',
  );
}
