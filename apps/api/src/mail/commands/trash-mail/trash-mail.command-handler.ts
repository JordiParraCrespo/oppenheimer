import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { GmailBulkOutcome } from '../../infrastructure/gmail-provider.port';
import { TrashMailCommand } from './trash-mail.command';

@CommandHandler(TrashMailCommand)
export class TrashMailCommandHandler
  implements ICommandHandler<TrashMailCommand, GmailBulkOutcome>
{
  constructor(private readonly gmail: GmailCallResolver) {}

  async execute({
    scope,
    connectionId,
    threadIds,
    trash,
  }: TrashMailCommand): Promise<GmailBulkOutcome> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    return this.gmail.call(connection, (provider, grant) =>
      provider.trashThreads(grant, threadIds, trash),
    );
  }
}
