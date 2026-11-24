import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BotFormDecisionResolver } from '../../application/bot-form-decision.resolver';
import { SubmitBotFormCommand } from './submit-bot-form.command';

/**
 * The owner submits a form a bot asked them to fill (`ask_form`): a value
 * per field, each fitting its field (`BOTS_047` names what does not), and
 * the bot gets a turn that reads them.
 */
@CommandHandler(SubmitBotFormCommand)
export class SubmitBotFormCommandHandler implements ICommandHandler<SubmitBotFormCommand, string> {
  constructor(private readonly decisions: BotFormDecisionResolver) {}

  execute(command: SubmitBotFormCommand): Promise<string> {
    const { scope, botId, formId, values, deciderName, credentialScopes } = command;
    return this.decisions.decide(
      {
        scope,
        botId,
        formId,
        name: deciderName,
        credentialScopes,
        correlationId: command.metadata.correlationId,
      },
      (form) => {
        const problem = form.valuesProblem(values);
        if (problem) throw new AppError(BotErrors.FORM_VALUES_INVALID, { detail: problem });
        form.submit(scope.userId, new Date(), values, credentialScopes);
      },
    );
  }
}
