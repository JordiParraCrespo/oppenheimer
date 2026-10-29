import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import { DeleteMailDraftCommand } from './delete-mail-draft.command';

@CommandHandler(DeleteMailDraftCommand)
export class DeleteMailDraftCommandHandler
  implements ICommandHandler<DeleteMailDraftCommand, void>
{
  constructor(private readonly gmail: GmailCallResolver) {}

  async execute({ scope, connectionId, draftId }: DeleteMailDraftCommand): Promise<void> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    await this.gmail.call(connection, (provider, grant) => provider.deleteDraft(grant, draftId));
  }
}
