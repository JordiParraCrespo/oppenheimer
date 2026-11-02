import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { GmailLabel } from '../../infrastructure/gmail-provider.port';
import { CreateMailLabelCommand } from './create-mail-label.command';

/** Answers the label Gmail made: its id is what labelling names it by; Gmail owns it. */
@CommandHandler(CreateMailLabelCommand)
export class CreateMailLabelCommandHandler
  implements ICommandHandler<CreateMailLabelCommand, GmailLabel>
{
  constructor(private readonly gmail: GmailCallResolver) {}

  async execute({ scope, connectionId, name }: CreateMailLabelCommand): Promise<GmailLabel> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    return this.gmail.call(connection, (provider, grant) => provider.createLabel(grant, name));
  }
}
