import { deliveryDetail } from '../delivery/read';
import 'server-only';
import type { PrismaClient } from '../../../generated/prisma/client';
import { requireAdminPermission } from '../../auth/admin-policy';
import type { Directory } from '../../admin/directory';
import { StudentError } from '../../student/errors';
import { orderInclude, orderDTO } from './orders';
import { CommercePayments } from './payments';
import type { PaymentGateway } from './gateway';
export class CommerceAdmin {
  constructor(
    private db: PrismaClient,
    private actorId: string,
    private directory: Directory,
  ) {}
  async authorize() {
    await requireAdminPermission(this.db, this.actorId, 'COMMERCE_VIEW');
  }
  async list(page = 1) {
    await this.authorize();
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new StudentError('INVALID_INPUT');
    const rows = await this.db.marketplaceOrder.findMany({
      include: { ...orderInclude, user: { select: { clerkUserId: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 20,
      take: 21,
    });
    const users = await this.directory.lookup([
      ...new Set(rows.slice(0, 20).map((r) => r.user.clerkUserId)),
    ]);
    await this.authorize();
    return {
      page,
      hasNext: rows.length > 20,
      items: rows.slice(0, 20).map((row) => {
        const identity = users.get(row.user.clerkUserId);
        return {
          ...orderDTO(row),
          customer: {
            name: identity?.name || 'Account unavailable',
            email: identity?.email || null,
          },
        };
      }),
    };
  }
  async detail(ref: string) {
    await this.authorize();
    const row = await this.db.marketplaceOrder.findFirst({
      where: { publicRef: ref },
      include: {
        ...orderInclude,
        user: { select: { clerkUserId: true } },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { kind: true, safeCode: true, createdAt: true },
        },
      },
    });
    if (!row) throw new StudentError('NOT_FOUND');
    const identity = (await this.directory.lookup([row.user.clerkUserId])).get(
      row.user.clerkUserId,
    );
    const delivery = row.entitlement
      ? await deliveryDetail(this.db, row.entitlement.id)
      : null;
    await this.authorize();
    return {
      ...orderDTO(row),
      provider: row.attempt?.provider || null,
      customer: {
        name: identity?.name || 'Account unavailable',
        email: identity?.email || null,
      },
      delivery,
      events: row.events.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
  async reconcile(ref: string, gateway: PaymentGateway) {
    await this.authorize();
    await requireAdminPermission(this.db, this.actorId, 'COMMERCE_MANAGE');
    const row = await this.db.marketplaceOrder.findUnique({
      where: { publicRef: ref },
      select: { attempt: { select: { id: true } } },
    });
    if (!row?.attempt) throw new StudentError('NOT_FOUND');
    await new CommercePayments(this.db, gateway).reconcileAttempt(
      row.attempt.id,
      this.actorId,
      true,
    );
    return this.detail(ref);
  }
}
export async function reconcilePendingCommerce(
  db: PrismaClient,
  gateway: PaymentGateway,
  actorId: string,
  batchSize = 25,
) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100)
    throw new StudentError('INVALID_INPUT');
  await requireAdminPermission(db, actorId, 'COMMERCE_VIEW');
  await requireAdminPermission(db, actorId, 'COMMERCE_MANAGE');
  const service = new CommercePayments(db, gateway);
  const events = await db.marketplacePaymentEvent.findMany({
    where: {
      provider: gateway.provider,
      merchantRef: gateway.merchantRef,
      status: { in: ['RECEIVED', 'UNRESOLVED'] },
    },
    orderBy: { receivedAt: 'asc' },
    take: batchSize,
    select: { id: true },
  });
  let reconciled = 0,
    unresolved = 0;
  for (const event of events) {
    try {
      await service.processEvent(event.id, actorId);
      const state = await db.marketplacePaymentEvent.findUniqueOrThrow({
        where: { id: event.id },
        select: { status: true },
      });
      if (state.status === 'PROCESSED') reconciled++;
      else unresolved++;
    } catch {
      unresolved++;
    }
  }
  const attempts = await db.marketplacePaymentAttempt.findMany({
    where: {
      provider: gateway.provider,
      merchantRef: gateway.merchantRef,
      status: {
        in: [
          'CREATING',
          'UNKNOWN',
          'PROVIDER_PENDING',
          'AUTHORIZED',
          'CAPTURED',
        ],
      },
    },
    orderBy: { updatedAt: 'asc' },
    take: batchSize,
    select: { id: true },
  });
  for (const attempt of attempts) {
    try {
      await service.reconcileAttempt(attempt.id, actorId, true);
      reconciled++;
    } catch {
      unresolved++;
    }
  }
  return { examined: events.length + attempts.length, reconciled, unresolved };
}
