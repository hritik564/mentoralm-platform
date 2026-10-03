import 'server-only';
import { AdminLearningOperations } from './learning';
import { parseInput } from '../validation';
import {
  moderationInput,
  supportInput,
  communicationInput,
  audienceInput,
} from './validation';
import { StudentError } from '../../student/errors';
import { BatchCommunications } from '../../lms/communications';
export class AdminOperationalActions extends AdminLearningOperations {
  async moderate(threadId: string, input: unknown) {
    const c = parseInput(moderationInput, input);
    return this.write('DiscussionLockChanged', async (tx) => {
      const before = await tx.discussionThread.findUnique({
        where: { id: threadId },
      });
      if (!before) throw new StudentError('NOT_FOUND');
      await tx.discussionThread.update({
        where: { id: threadId },
        data: { locked: c.locked, updatedAt: new Date() },
      });
      return {
        value: threadId,
        targetId: threadId,
        details: {
          beforeLocked: before.locked,
          afterLocked: c.locked,
          reason: c.reason,
          courseId: before.courseId,
          batchId: before.batchId,
        },
      };
    });
  }
  async support(ticketId: string, input: unknown) {
    const c = parseInput(supportInput, input);
    return this.write('SupportAdminAction', async (tx) => {
      const before = await tx.supportTicket.findUnique({
        where: { id: ticketId },
      });
      if (!before) throw new StudentError('NOT_FOUND');
      if (c.body && !['OPEN', 'IN_PROGRESS'].includes(before.status))
        throw new StudentError('CONFLICT');
      if (c.body)
        await tx.supportMessage.create({
          data: {
            ticketId,
            senderId: this.actorId,
            actor: 'STAFF',
            body: c.body,
          },
        });
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: c.status, updatedAt: new Date() },
      });
      return {
        value: ticketId,
        targetId: ticketId,
        details: {
          userId: before.userId,
          beforeStatus: before.status,
          afterStatus: c.status,
          replyCreated: !!c.body,
        },
      };
    });
  }
  async audience(input: unknown) {
    await this.authorize('COMMUNICATIONS_MANAGE');
    const c = parseInput(audienceInput, input);
    const rows = await new BatchCommunications(this.db, this.actorId).audience(
      c.batchId,
      c.channel,
      c.purpose,
      { adminOnly: true },
    );
    return {
      total: rows.length,
      pendingProvider: rows.filter((r) => r.allowed).length,
      suppressed: rows.filter((r) => !r.allowed).length,
      provider: 'UNCONFIGURED' as const,
    };
  }
  async plan(input: unknown) {
    await this.authorize('COMMUNICATIONS_MANAGE');
    const c = parseInput(communicationInput, input);
    return new BatchCommunications(this.db, this.actorId).plan(c, {
      adminOnly: true,
    });
  }
}
