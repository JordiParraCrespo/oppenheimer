import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { BOT_PERMISSION_RULES_MAX } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_PERMISSION_RULE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotPermissionRuleRepositoryPort } from '../../database/bot-permission-rule.repository.port';
import { BotPermissionRuleEntity } from '../../domain/bot-permission-rule.entity';
import { CreateBotPermissionRuleCommand } from './create-bot-permission-rule.command';

/**
 * A plain-language rule for a bot (`25-bots.md` §5): `allow` lets a matching
 * asking call run without a card, `ask` makes one ask. Past
 * `BOT_PERMISSION_RULES_MAX` is `BOTS_031`, counted under a lock on the bot.
 */
@CommandHandler(CreateBotPermissionRuleCommand)
export class CreateBotPermissionRuleCommandHandler
  implements ICommandHandler<CreateBotPermissionRuleCommand, string>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_PERMISSION_RULE_REPOSITORY) private readonly rules: BotPermissionRuleRepositoryPort,
  ) {}

  async execute({ scope, botId, effect, text }: CreateBotPermissionRuleCommand): Promise<string> {
    const bot = await this.lookup.bot(scope, botId);
    const rule = BotPermissionRuleEntity.write({
      organizationId: bot.organizationId,
      botId: bot.id,
      effect,
      text,
      userId: scope.userId,
    });
    const outcome = await this.rules.insert(rule, BOT_PERMISSION_RULES_MAX);
    if (outcome === 'full') throw new AppError(BotErrors.PERMISSION_RULES_FULL);
    if (outcome === 'missing') throw new AppError(BotErrors.NOT_FOUND);
    return rule.id;
  }
}
