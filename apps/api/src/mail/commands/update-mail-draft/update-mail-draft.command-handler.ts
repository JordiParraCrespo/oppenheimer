import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import { MailComposeResolver } from '../../application/mail-compose.resolver';
import type { GmailDraftRef } from '../../infrastructure/gmail-provider.port';
import { UpdateMailDraftCommand } from './update-mail-draft.command';

/** Rewrites a draft whole: Gmail keeps the draft's id and gives it a new message. */
@CommandHandler(UpdateMailDraftCommand)
export class UpdateMailDraftCommandHandler
  implements ICommandHandler<UpdateMailDraftCommand, GmailDraftRef>
{
  constructor(
    private readonly gmail: GmailCallResolver,
    private readonly compose: MailComposeResolver,
  ) {}

  async execute({
    scope,
    draftId,
    plan,
    localFiles,
  }: UpdateMailDraftCommand): Promise<GmailDraftRef> {
    const connection = await this.gmail.activeConnection(scope, plan.connectionId);
    return this.gmail.call(connection, async (provider, grant) =>
      provider.updateDraft(
        grant,
        draftId,
        await this.compose.build(provider, grant, plan, localFiles),
      ),
    );
  }
}
