import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { upstreamRateLimitOf } from '@oppenheimer/backend-core';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { GmailBulkOutcome } from '../../infrastructure/gmail-provider.port';
import { OrganizeMailCommand } from './organize-mail.command';

/**
 * Applies a label change to threads, one by one, and to messages, in one
 * batch. A thread Gmail does not have is answered as missing; the messages
 * are counted as changed, since Gmail's batch answers nothing per message.
 * When Gmail's limit stops the threads partway, the batch is not sent: its
 * messages are not reached either. When it stops the batch after threads
 * changed, the threads are answered as changed and the messages as not
 * reached.
 */
@CommandHandler(OrganizeMailCommand)
export class OrganizeMailCommandHandler
  implements ICommandHandler<OrganizeMailCommand, GmailBulkOutcome>
{
  constructor(private readonly gmail: GmailCallResolver) {}

  async execute(command: OrganizeMailCommand): Promise<GmailBulkOutcome> {
    const { scope, connectionId, threadIds, messageIds, change } = command;
    const connection = await this.gmail.activeConnection(scope, connectionId);
    return this.gmail.call(connection, async (provider, grant) => {
      const threads: GmailBulkOutcome = threadIds.length
        ? await provider.modifyThreads(grant, threadIds, change)
        : { changed: [], missing: [], notReached: [], limited: null };
      if (threads.limited)
        return { ...threads, notReached: [...threads.notReached, ...messageIds] };
      if (!messageIds.length) return threads;
      try {
        await provider.modifyMessages(grant, messageIds, change);
      } catch (error) {
        // The threads changed before the batch was limited: that is said, not lost.
        const limited = upstreamRateLimitOf(error);
        if (!limited || threads.changed.length === 0) throw error;
        return { ...threads, notReached: [...messageIds], limited };
      }
      return { ...threads, changed: [...threads.changed, ...messageIds] };
    });
  }
}
