import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import { MailComposeResolver } from '../../application/mail-compose.resolver';
import type { GmailDraftRef } from '../../infrastructure/gmail-provider.port';
import { CreateMailDraftCommand } from './create-mail-draft.command';

/**
 * Writes a draft into the caller's Gmail, where they see it, edit it and send
 * it themselves (`product/next-steps/mail.md` §3.3). Gmail's draft and message
 * ids come back: Gmail owns the draft, and they are what a link opens.
 */
@CommandHandler(CreateMailDraftCommand)
export class CreateMailDraftCommandHandler
  implements ICommandHandler<CreateMailDraftCommand, GmailDraftRef>
{
  constructor(
    private readonly gmail: GmailCallResolver,
    private readonly compose: MailComposeResolver,
  ) {}

  async execute({ scope, plan }: CreateMailDraftCommand): Promise<GmailDraftRef> {
    const connection = await this.gmail.activeConnection(scope, plan.connectionId);
    return this.gmail.call(connection, async (provider, grant) =>
      provider.createDraft(grant, await this.compose.build(provider, grant, plan)),
    );
  }
}
