import 'server-only';
import type { Prisma } from '../../../generated/prisma/client';
import { independentLmsAccessWhere } from '../../lms/entitlement';
import { commerceAudit } from '../commerce/core';

/** Trusted provisioning validates prerequisites directly, never via the public ACTIVE gate. */
export async function ensureMarketplaceLearner(
  tx: Prisma.TransactionClient,
  delivery: {
    id: string;
    entitlement: {
      userId: string;
      orderId: string;
      status: string;
      order: { intentId: string };
    };
  },
  actorId: string | null,
  now: Date,
) {
  const e = delivery.entitlement;
  if (e.status !== 'ACTIVE')
    throw new Error('Commercial authorization required');
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`marketplace-learner:${e.userId}`},0))::text`;
  let user = await tx.user.findUniqueOrThrow({
    where: { id: e.userId },
    include: { marketplaceLearner: true },
  });
  if (user.lmsAccessOverride === 'DISABLED') return null;
  const audit = (
    kind:
      | 'MarketplaceLearnerProvisioned'
      | 'MarketplaceLmsAccessGranted'
      | 'MarketplaceLmsAccessReused',
  ) => commerceAudit(tx, e.order.intentId, e.orderId, kind, actorId);
  let identityCreated = false;
  if (user.role !== 'STUDENT' && !user.marketplaceLearner) {
    await tx.marketplaceLearnerIdentity.create({
      data: { userId: user.id, createdByDeliveryId: delivery.id },
    });
    // Invoke the SAME PostgreSQL issuer/sequence. Never supply an ID or change persona.
    user = await tx.user.update({
      where: { id: user.id },
      data: { updatedAt: now },
      include: { marketplaceLearner: true },
    });
    identityCreated = true;
    await audit('MarketplaceLearnerProvisioned');
  }
  if (!user.studentId) throw new Error('Learner identity unavailable');
  const independent = await tx.user.findFirst({
    where: { id: user.id, ...independentLmsAccessWhere(now) },
    select: { id: true },
  });
  await audit(
    independent ? 'MarketplaceLmsAccessReused' : 'MarketplaceLmsAccessGranted',
  );
  return {
    learnerIdentityProvenance: identityCreated
      ? ('CREATED' as const)
      : ('REUSED' as const),
    lmsAccessProvenance: independent
      ? ('REUSED' as const)
      : ('CREATED' as const),
  };
}
