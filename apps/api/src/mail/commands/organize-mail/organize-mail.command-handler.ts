import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { GmailBulkOutcome } from '../../infrastructure/gmail-provider.port';
import { OrganizeMailCommand } from './organize-mail.command';

/**
 * Applies a label change to threads, one by one, and to messages, in one
 * batch. A thread Gmail does not have is answered as missing; the messages
 * are counted as changed, since Gmail's batch answers nothing per message.
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
      const threads = threadIds.length
        ? await provider.modifyThreads(grant, threadIds, change)
        : { changed: [], missing: [] };
      if (messageIds.length) await provider.modifyMessages(grant, messageIds, change);
      return { changed: [...threads.changed, ...messageIds], missing: threads.missing };
    });
  }
}
