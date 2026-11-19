import 'server-only';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  Prisma,
  PrismaClient,
  MarketplaceIntentState,
} from '../../../generated/prisma/client';
import { StudentError } from '../../student/errors';
import { parseInput } from '../../admin/validation';
import {
  aboutInput,
  educationInput,
  goalInput,
  intentRefInput,
  intentRevisionInput,
  onboardingStepInput,
  startIntentInput,
} from './validation';
import {
  CONSENT_VERSION,
  ENROLLMENT_HOURS,
  educationLevels,
  type EnrollmentView,
  type EnrollmentQuote,
} from './types';
type TX = Prisma.TransactionClient;
const activeStates: MarketplaceIntentState[] = [
  'ACCOUNT_REQUIRED',
  'ONBOARDING_REQUIRED',
  'READY_FOR_CHECKOUT',
];
const include = {
  offering: {
    select: {
      slug: true,
      publicationStatus: true,
      availabilityStatus: true,
      priceMinor: true,
    },
  },
  onboarding: true,
} as const;
type Row = Prisma.MarketplaceEnrollmentIntentGetPayload<{
  include: typeof include;
}>;
async function transaction<T>(
  db: PrismaClient,
  work: (tx: TX) => Promise<T>,
): Promise<T> {
  for (let i = 0; i < 8; i++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (e) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        ['P2034', 'P2002'].includes(String(e.code)) &&
        i < 7
      )
        continue;
      throw e;
    }
  }
  throw new StudentError('CONFLICT');
}
function proof(a: string | null, b: string | null) {
  return (
    !!a &&
    !!b &&
    a.length === 64 &&
    b.length === 64 &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
function access(row: Row, now: Date): EnrollmentView['access'] {
  if (row.state === 'CANCELLED') return 'cancelled';
  if (row.state === 'EXPIRED' || row.expiresAt <= now) return 'expired';
  if (
    row.offering.publicationStatus !== 'PUBLISHED' ||
    row.offering.availabilityStatus !== 'OPEN' ||
    row.offering.priceMinor === null
  )
    return 'unavailable';
  return 'active';
}
function quote(row: Row): EnrollmentQuote {
  return {
    slug: row.offering.slug,
    title: row.titleSnapshot,
    priceMinor: row.priceMinor,
    currency: row.currency,
    durationLabel: row.durationLabel,
    deliveryMode: row.deliveryMode,
    cohortStartsAt: row.cohortStartsAt?.toISOString() || null,
  };
}
async function event(
  tx: TX,
  row: { id: string; state: MarketplaceIntentState },
  actorId: string | null,
  kind: Prisma.MarketplaceEnrollmentEventCreateInput['kind'],
  afterState: MarketplaceIntentState,
  changedFields: string[] = [],
) {
  await tx.marketplaceEnrollmentEvent.create({
    data: {
      intentId: row.id,
      actorId,
      kind,
      beforeState: row.state,
      afterState,
      changedFields,
    },
  });
}
/** Private pre-payment domain. It never writes LMS, payment or public-cache state. */
export class EnrollmentService {
  constructor(
    private db: PrismaClient,
    private now: () => Date = () => new Date(),
  ) {}
  private async owned(
    tx: TX | PrismaClient,
    ref: string,
    actorId: string | null,
    browserHash: string | null,
  ) {
    if (!intentRefInput.safeParse(ref).success)
      throw new StudentError('NOT_FOUND');
    const row = await tx.marketplaceEnrollmentIntent.findUnique({
      where: { publicRef: ref },
      include,
    });
    if (
      !row ||
      (row.userId
        ? row.userId !== actorId
        : !proof(row.browserHash, browserHash))
    )
      throw new StudentError('NOT_FOUND');
    return row;
  }
  private usable(row: Row) {
    if (access(row, this.now()) !== 'active')
      throw new StudentError('CONFLICT');
  }
  private async dto(row: Row, actorId: string | null): Promise<EnrollmentView> {
    const o = row.onboarding;
    const profile =
      row.userId && row.userId === actorId && !o
        ? await this.db.studentProfile.findUnique({
            where: { userId: row.userId },
            select: { educationLevel: true, institution: true },
          })
        : null;
    const education =
      educationLevels.find((v) => v === profile?.educationLevel) || null;
    return {
      ref: row.publicRef,
      revision: row.revision,
      state:
        row.expiresAt <= this.now() && row.state !== 'CANCELLED'
          ? 'EXPIRED'
          : row.state,
      access: access(row, this.now()),
      needsClaim: !row.userId,
      quote: quote(row),
      expiresAt: row.expiresAt.toISOString(),
      completedStep: o?.completedStep || 0,
      completedAt: o?.completedAt?.toISOString() || null,
      values: {
        fullName: o?.fullName || null,
        phone: o?.phone || null,
        city: o?.city || null,
        region: o?.region || null,
        country: o?.country || null,
        educationLevel: o?.educationLevel || education,
        currentStatus: o?.currentStatus || null,
        institution: o?.institution || profile?.institution || null,
        goal: o?.goal || null,
        source: o?.source || null,
      },
    };
  }
  async view(ref: string, actorId: string | null, browserHash: string | null) {
    return this.dto(
      await this.owned(this.db, ref, actorId, browserHash),
      actorId,
    );
  }
  async checkout(ref: string, actorId: string) {
    const row = await this.owned(this.db, ref, actorId, null);
    this.usable(row);
    if (row.state !== 'READY_FOR_CHECKOUT' || !row.onboarding?.completedAt)
      throw new StudentError('CONFLICT');
    return this.dto(row, actorId);
  }
  async start(actorId: string | null, browserHash: string, input: unknown) {
    const { slug } = parseInput(startIntentInput, input);
    if (!/^[a-f0-9]{64}$/.test(browserHash))
      throw new StudentError('INVALID_INPUT');
    const row = await transaction(this.db, async (tx) => {
      const offering = await tx.marketplaceOffering.findFirst({
        where: { slug, publicationStatus: 'PUBLISHED' },
      });
      if (!offering) throw new StudentError('NOT_FOUND');
      if (
        actorId &&
        (await tx.marketplaceEntitlement.findFirst({
          where: { userId: actorId, offeringId: offering.id, status: 'ACTIVE' },
        }))
      )
        throw new StudentError('CONFLICT');
      if (
        offering.availabilityStatus !== 'OPEN' ||
        offering.priceMinor === null
      )
        throw new StudentError('CONFLICT');
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`marketplace-intent:${actorId || browserHash}:${offering.id}`},0))::text`;
      const identity = actorId
        ? { userId: actorId }
        : { userId: null, browserHash };
      const commercial = {
        offeringId: offering.id,
        titleSnapshot: offering.title,
        priceMinor: offering.priceMinor,
        currency: offering.currency,
        durationLabel: offering.durationLabel,
        deliveryMode: offering.deliveryMode,
        cohortStartsAt: offering.cohortStartsAt,
      };
      const existing = await tx.marketplaceEnrollmentIntent.findFirst({
        where: {
          ...identity,
          ...commercial,
          state: { in: activeStates },
          expiresAt: { gt: this.now() },
        },
        orderBy: { createdAt: 'desc' },
        include,
      });
      if (existing) return existing;
      const now = this.now();
      const created = await tx.marketplaceEnrollmentIntent.create({
        data: {
          ...commercial,
          ...identity,
          browserHash: actorId ? null : browserHash,
          publicRef: randomBytes(32).toString('base64url'),
          state: actorId ? 'ONBOARDING_REQUIRED' : 'ACCOUNT_REQUIRED',
          expiresAt: new Date(now.getTime() + ENROLLMENT_HOURS * 3600000),
          createdAt: now,
        },
        include,
      });
      await event(
        tx,
        created,
        actorId,
        'EnrollmentIntentCreated',
        created.state,
        ['offering', 'quote'],
      );
      return created;
    });
    return this.dto(row, actorId);
  }
  async claim(
    ref: string,
    actorId: string,
    browserHash: string | null,
    input: unknown,
  ) {
    const { revision } = parseInput(intentRevisionInput, input);
    const row = await transaction(this.db, async (tx) => {
      const before = await this.owned(tx, ref, actorId, browserHash);
      this.usable(before);
      if (before.userId === actorId) return before;
      if (before.revision !== revision) throw new StudentError('CONFLICT');
      const claimed = await tx.marketplaceEnrollmentIntent.updateMany({
        where: {
          id: before.id,
          userId: null,
          revision,
          browserHash: before.browserHash,
        },
        data: {
          userId: actorId,
          browserHash: null,
          state: 'ONBOARDING_REQUIRED',
          revision: randomUUID(),
        },
      });
      if (claimed.count !== 1) throw new StudentError('CONFLICT');
      await event(
        tx,
        before,
        actorId,
        'EnrollmentIntentClaimed',
        'ONBOARDING_REQUIRED',
        ['account'],
      );
      return tx.marketplaceEnrollmentIntent.findUniqueOrThrow({
        where: { id: before.id },
        include,
      });
    });
    return this.dto(row, actorId);
  }
  async saveStep(ref: string, actorId: string, input: unknown) {
    const data = parseInput(onboardingStepInput, input);
    const row = await transaction(this.db, async (tx) => {
      const before = await this.owned(tx, ref, actorId, null);
      this.usable(before);
      if (
        await tx.marketplaceOrder.findFirst({
          where: {
            intentId: before.id,
            status: { notIn: ['CANCELLED', 'EXPIRED', 'REFUNDED'] },
          },
        })
      )
        throw new StudentError('CONFLICT');
      if (before.revision !== data.revision) throw new StudentError('CONFLICT');
      const old = before.onboarding;
      if (data.step > (old?.completedStep || 0) + 1)
        throw new StudentError('CONFLICT');
      const complete = data.step === 4;
      if (complete) {
        if (!old) throw new StudentError('CONFLICT');
        parseInput(aboutInput, {
          fullName: old.fullName,
          phone: old.phone,
          city: old.city,
          region: old.region,
          country: old.country,
        });
        parseInput(educationInput, {
          educationLevel: old.educationLevel,
          currentStatus: old.currentStatus,
          institution: old.institution,
        });
        parseInput(goalInput, { goal: old.goal, source: old.source });
      }
      const { revision, step, ...fields } = data;
      void revision;
      const values: Prisma.MarketplaceEnrollmentOnboardingUncheckedUpdateInput =
        complete
          ? { completedAt: this.now(), consentVersion: CONSENT_VERSION }
          : {
              ...fields,
              completedAt: null,
              consentVersion: null,
              completedStep: Math.max(old?.completedStep || 0, step),
            };
      const afterState = complete
        ? 'READY_FOR_CHECKOUT'
        : 'ONBOARDING_REQUIRED';
      const updated = await tx.marketplaceEnrollmentIntent.updateMany({
        where: { id: before.id, userId: actorId, revision: data.revision },
        data: { revision: randomUUID(), state: afterState },
      });
      if (updated.count !== 1) throw new StudentError('CONFLICT');
      if (old)
        await tx.marketplaceEnrollmentOnboarding.update({
          where: { intentId: before.id },
          data: values,
        });
      else if (data.step === 1)
        await tx.marketplaceEnrollmentOnboarding.create({
          data: {
            intentId: before.id,
            fullName: data.fullName,
            phone: data.phone,
            city: data.city,
            region: data.region,
            country: data.country,
            completedStep: 1,
          },
        });
      else throw new StudentError('CONFLICT');
      await event(
        tx,
        before,
        actorId,
        complete ? 'EnrollmentReadyForCheckout' : 'EnrollmentOnboardingUpdated',
        afterState,
        complete ? ['consent'] : Object.keys(fields),
      );
      return tx.marketplaceEnrollmentIntent.findUniqueOrThrow({
        where: { id: before.id },
        include,
      });
    });
    return this.dto(row, actorId);
  }
  async cancel(ref: string, actorId: string, input: unknown) {
    const { revision } = parseInput(intentRevisionInput, input);
    const row = await transaction(this.db, async (tx) => {
      const before = await this.owned(tx, ref, actorId, null);
      this.usable(before);
      if (
        await tx.marketplaceOrder.findFirst({
          where: {
            intentId: before.id,
            status: { notIn: ['CANCELLED', 'EXPIRED', 'REFUNDED'] },
          },
        })
      )
        throw new StudentError('CONFLICT');
      if (before.revision !== revision) throw new StudentError('CONFLICT');
      await tx.marketplaceEnrollmentIntent.update({
        where: { id: before.id },
        data: { state: 'CANCELLED', revision: randomUUID() },
      });
      await event(
        tx,
        before,
        actorId,
        'EnrollmentIntentCancelled',
        'CANCELLED',
      );
      return tx.marketplaceEnrollmentIntent.findUniqueOrThrow({
        where: { id: before.id },
        include,
      });
    });
    return this.dto(row, actorId);
  }
}
