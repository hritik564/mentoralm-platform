import 'server-only';
import { mutationLimiter } from '../student/abuse';
import { z } from 'zod';
import type {
  Prisma,
  PrismaClient,
  CommunicationChannel,
  CommunicationPurpose,
} from '../../generated/prisma/client';
import { StudentError } from '../student/errors';
import { academicTransaction } from './completion';
// Future sources must get separate scoped resolvers; arbitrary selected IDs are never accepted.
export type CommunicationAudience =
  | { kind: 'BATCH'; batchId: string }
  | { kind: 'COURSE'; courseId: string }
  | { kind: 'PROGRAM'; programId: string }
  | { kind: 'SELECTED_STUDENTS'; batchId: string; studentIds: string[] };
const messageInput = z
  .object({
    batchId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    channel: z.enum(['EMAIL', 'WHATSAPP', 'IN_APP']),
    purpose: z.enum(['OPERATIONAL', 'MARKETING']),
    subject: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(6000),
  })
  .strict();
export class BatchCommunications {
  constructor(
    private db: PrismaClient,
    private actorId: string,
  ) {}
  private async authorize(
    db: Prisma.TransactionClient,
    batchId: string,
    purpose: CommunicationPurpose,
  ) {
    const actor = await db.user.findUnique({
      where: { id: this.actorId },
      select: { role: true },
    });
    const batch = await db.batch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        instructors: {
          where: { instructorId: this.actorId },
          select: { instructorId: true },
        },
      },
    });
    if (
      !batch ||
      !(
        actor?.role === 'ADMIN' ||
        (purpose === 'OPERATIONAL' &&
          actor?.role === 'INSTRUCTOR' &&
          batch.instructors.length)
      )
    )
      throw new StudentError('FORBIDDEN');
  }
  private async resolve(
    db: Prisma.TransactionClient,
    batchId: string,
    channel: CommunicationChannel,
    purpose: CommunicationPurpose,
  ) {
    await this.authorize(db, batchId, purpose);
    const now = new Date();
    const members = await db.batchMembership.findMany({
      where: {
        batchId,
        batch: {
          status: 'ACTIVE',
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        status: 'ACTIVE',
        joinedAt: { lte: now },
        OR: [{ leftAt: null }, { leftAt: { gt: now } }],
        student: { role: 'STUDENT' },
      },
      select: {
        userId: true,
        student: {
          select: {
            communicationPreferences: {
              where: { channel, purpose },
              select: { allowed: true },
            },
          },
        },
      },
      orderBy: { userId: 'asc' },
    });
    // Every channel defaults to denied until an explicit preference exists, including in-app.
    return members.map((m) => ({
      userId: m.userId,
      allowed: m.student.communicationPreferences[0]?.allowed === true,
    }));
  }
  async audience(
    batchId: string,
    channel: CommunicationChannel,
    purpose: CommunicationPurpose,
  ) {
    if (
      !z.enum(['EMAIL', 'WHATSAPP', 'IN_APP']).safeParse(channel).success ||
      !z.enum(['OPERATIONAL', 'MARKETING']).safeParse(purpose).success
    )
      throw new StudentError('INVALID_INPUT');
    return academicTransaction(this.db, (db) =>
      this.resolve(db, batchId, channel, purpose),
    );
  }
  async plan(input: unknown) {
    mutationLimiter.check(this.actorId, 'communication');
    const p = messageInput.safeParse(input);
    if (!p.success) throw new StudentError('INVALID_INPUT');
    return academicTransaction(this.db, async (db) => {
      const audience = await this.resolve(
        db,
        p.data.batchId,
        p.data.channel,
        p.data.purpose,
      );
      const message = await db.communicationMessage.create({
        data: {
          ...p.data,
          initiatorId: this.actorId,
          deliveries: {
            create: audience.map((m) => ({
              userId: m.userId,
              status: m.allowed ? 'PENDING_PROVIDER' : 'SUPPRESSED',
              reason: m.allowed
                ? 'No delivery provider configured'
                : 'No explicit channel/purpose permission',
            })),
          },
        },
        select: { id: true },
      });
      await db.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: 'COMMUNICATION_PLANNED',
          targetId: message.id,
        },
      });
      return message;
    });
  }
  /** Trusted future consent workflow only. No student/admin HTTP control or inferred opt-in. */
  async preference(
    userId: string,
    channel: CommunicationChannel,
    purpose: CommunicationPurpose,
    allowed: boolean,
    evidence: string,
  ) {
    if (
      !z.enum(['EMAIL', 'WHATSAPP', 'IN_APP']).safeParse(channel).success ||
      !z.enum(['OPERATIONAL', 'MARKETING']).safeParse(purpose).success ||
      typeof allowed !== 'boolean' ||
      !evidence.trim() ||
      evidence.length > 500
    )
      throw new StudentError('INVALID_INPUT');
    return academicTransaction(this.db, async (db) => {
      const actor = await db.user.findUnique({
        where: { id: this.actorId },
        select: { role: true },
      });
      if (actor?.role !== 'ADMIN') throw new StudentError('FORBIDDEN');
      if (
        !(await db.user.findFirst({
          where: { id: userId, role: 'STUDENT' },
          select: { id: true },
        }))
      )
        throw new StudentError('NOT_FOUND');
      const previous = await db.communicationPreference.findUnique({
        where: { userId_channel_purpose: { userId, channel, purpose } },
      });
      await db.communicationPreference.upsert({
        where: { userId_channel_purpose: { userId, channel, purpose } },
        create: {
          userId,
          channel,
          purpose,
          allowed,
          evidence: evidence.trim(),
        },
        update: { allowed, evidence: evidence.trim() },
      });
      await db.academicAudit.create({
        data: {
          actorId: this.actorId,
          action: `COMMUNICATION_PREFERENCE_${channel}_${purpose}_${allowed ? 'ENABLE' : 'DISABLE'}`,
          targetId: userId,
          details: {
            previousAllowed: previous?.allowed ?? null,
            previousEvidence: previous?.evidence ?? null,
            allowed,
            evidence: evidence.trim(),
          },
        },
      });
    });
  }
}
