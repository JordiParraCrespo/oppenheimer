import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_PERMISSION_RULE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotPermissionRuleRepositoryPort } from '../../database/bot-permission-rule.repository.port';
import { DeleteBotPermissionRuleCommand } from './delete-bot-permission-rule.command';

/** Removes one of a bot's rules (`25-bots.md` §5); one that is not this bot's, or is gone, is `BOTS_032`. */
@CommandHandler(DeleteBotPermissionRuleCommand)
export class DeleteBotPermissionRuleCommandHandler
  implements ICommandHandler<DeleteBotPermissionRuleCommand, string>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_PERMISSION_RULE_REPOSITORY) private readonly store: BotPermissionRuleRepositoryPort,
  ) {}

  async execute({ scope, botId, ruleId }: DeleteBotPermissionRuleCommand): Promise<string> {
    const bot = await this.lookup.bot(scope, botId);
    if (!(await this.store.delete(scope, bot.id, ruleId))) {
      throw new AppError(BotErrors.PERMISSION_RULE_NOT_FOUND);
    }
    return ruleId;
  }
}
