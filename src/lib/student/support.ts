import 'server-only';
import { randomBytes } from 'node:crypto';
import type { PrismaClient, Prisma } from '../../generated/prisma/client';
import { StudentError } from './errors';
import { ticketInput, replyInput } from './validation';
function parse<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T } },
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new StudentError('INVALID_INPUT');
  return result.data!;
}
/** Existing Support domain, also available to persisted Marketplace purchasers of any primary persona. */
export class CustomerSupportRepository {
  constructor(
    private db: PrismaClient,
    private actor: { id: string },
  ) {}
  private async authorize(db: Prisma.TransactionClient = this.db) {
    if (
      !(await db.user.findFirst({
        where: {
          id: this.actor.id,
          OR: [{ role: 'STUDENT' }, { marketplaceEntitlements: { some: {} } }],
        },
        select: { id: true },
      }))
    )
      throw new StudentError('FORBIDDEN');
  }
  async tickets() {
    await this.authorize();
    return this.db.supportTicket.findMany({
      where: { userId: this.actor.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  async ticket(id: string) {
    await this.authorize();
    const ticket = await this.db.supportTicket.findFirst({
      where: { id, userId: this.actor.id },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 200 } },
    });
    if (!ticket) throw new StudentError('NOT_FOUND');
    return ticket;
  }
  async createTicket(input: unknown) {
    await this.authorize();
    const draft = parse(ticketInput, input);
    return this.db.supportTicket.create({
      data: {
        userId: this.actor.id,
        reference: `MT-${randomBytes(8).toString('hex').toUpperCase()}`,
        category: draft.category,
        subject: draft.subject,
        messages: {
          create: {
            senderId: this.actor.id,
            actor: 'STUDENT',
            body: draft.message,
          },
        },
      },
      select: { id: true },
    });
  }
  async reply(id: string, input: unknown) {
    await this.authorize();
    const { message } = parse(replyInput, input);
    // Serializable transaction coordinates reply permission with future status changes.
    await this.db.$transaction(
      async (transaction) => {
        await this.authorize(transaction);
        const ticket = await transaction.supportTicket.findFirst({
          where: { id, userId: this.actor.id },
        });
        if (!ticket) throw new StudentError('NOT_FOUND');
        if (!['OPEN', 'IN_PROGRESS'].includes(ticket.status))
          throw new StudentError('CONFLICT');
        await transaction.supportMessage.create({
          data: {
            ticketId: id,
            senderId: this.actor.id,
            actor: 'STUDENT',
            body: message,
          },
        });
        await transaction.supportTicket.update({
          where: { id },
          data: { updatedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
