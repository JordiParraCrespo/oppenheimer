import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotQuestionDecisionResolver } from '../../application/bot-question-decision.resolver';
import { DismissBotQuestionCommand } from './dismiss-bot-question.command';

/**
 * The owner declines a bot's card of questions (`25-bots.md` §3.2), with a
 * note if they like; the bot gets a turn that is told so and not to ask
 * again unless they bring it up.
 */
@CommandHandler(DismissBotQuestionCommand)
export class DismissBotQuestionCommandHandler
  implements ICommandHandler<DismissBotQuestionCommand, string>
{
  constructor(private readonly decisions: BotQuestionDecisionResolver) {}

  execute(command: DismissBotQuestionCommand): Promise<string> {
    const { scope, botId, questionId, note, deciderName, credentialScopes } = command;
    return this.decisions.decide(
      {
        scope,
        botId,
        questionId,
        name: deciderName,
        credentialScopes,
        correlationId: command.metadata.correlationId,
      },
      (question) => question.dismiss(scope.userId, new Date(), note, credentialScopes),
    );
  }
}
