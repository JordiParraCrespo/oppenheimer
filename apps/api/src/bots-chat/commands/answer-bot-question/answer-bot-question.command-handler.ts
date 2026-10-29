import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BotQuestionDecisionResolver } from '../../application/bot-question-decision.resolver';
import { AnswerBotQuestionCommand } from './answer-bot-question.command';

/**
 * The owner answers a bot's card of questions (`ask_user`, `25-bots.md`
 * §3.2): one answer per question, each fitting the options it has
 * (`BOTS_036` names what does not), and the bot gets a turn that reads them.
 */
@CommandHandler(AnswerBotQuestionCommand)
export class AnswerBotQuestionCommandHandler
  implements ICommandHandler<AnswerBotQuestionCommand, string>
{
  constructor(private readonly decisions: BotQuestionDecisionResolver) {}

  execute(command: AnswerBotQuestionCommand): Promise<string> {
    const { scope, botId, questionId, answers, deciderName, credentialScopes } = command;
    return this.decisions.decide(
      {
        scope,
        botId,
        questionId,
        name: deciderName,
        credentialScopes,
        correlationId: command.metadata.correlationId,
      },
      (question) => {
        const problem = question.answersProblem(answers);
        if (problem) throw new AppError(BotErrors.ANSWERS_INVALID, { detail: problem });
        question.answer(scope.userId, new Date(), answers, credentialScopes);
      },
    );
  }
}
