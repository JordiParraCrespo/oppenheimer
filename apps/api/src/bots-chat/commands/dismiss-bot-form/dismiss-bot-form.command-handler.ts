import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotFormDecisionResolver } from '../../application/bot-form-decision.resolver';
import { DismissBotFormCommand } from './dismiss-bot-form.command';

/**
 * The owner declines a form a bot asked them to fill, with a note if they
 * like; the bot gets a turn that is told so and not to ask again unless they
 * bring it up.
 */
@CommandHandler(DismissBotFormCommand)
export class DismissBotFormCommandHandler
  implements ICommandHandler<DismissBotFormCommand, string>
{
  constructor(private readonly decisions: BotFormDecisionResolver) {}

  execute(command: DismissBotFormCommand): Promise<string> {
    const { scope, botId, formId, note, deciderName, credentialScopes } = command;
    return this.decisions.decide(
      {
        scope,
        botId,
        formId,
        name: deciderName,
        credentialScopes,
        correlationId: command.metadata.correlationId,
      },
      (form) => form.dismiss(scope.userId, new Date(), note, credentialScopes),
    );
  }
}
