import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BotToolboxFactory } from '../../application/bot-toolbox.factory';
import { BOT_TOOL_PERMISSION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotToolPermissionRepositoryPort } from '../../database/bot-tool-permission.repository.port';
import { BotToolPermissionEntity } from '../../domain/bot-tool-permission.entity';
import { SetBotToolDecisionCommand } from './set-bot-tool-decision.command';

/**
 * Settings → Permissions, one tool (`25-bots.md` §5): Allow, Ask or Off, or
 * `default` to follow the preset again. A tool the catalog does not have is
 * `BOTS_029`; Allow for a tool decided call by call is `BOTS_030`. The next
 * turn reads it; a card already waiting runs or not as decided then.
 */
@CommandHandler(SetBotToolDecisionCommand)
export class SetBotToolDecisionCommandHandler
  implements ICommandHandler<SetBotToolDecisionCommand, string>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_TOOL_PERMISSION_REPOSITORY)
    private readonly settings: BotToolPermissionRepositoryPort,
    private readonly toolbox: BotToolboxFactory,
  ) {}

  async execute({ scope, botId, tool, decision }: SetBotToolDecisionCommand): Promise<string> {
    const bot = await this.lookup.bot(scope, botId);
    const listed = this.toolbox.listed().find(({ definition }) => definition.name === tool);
    if (!listed) throw new AppError(BotErrors.TOOL_UNKNOWN, { detail: `No tool named ${tool}` });
    if (decision === 'default') {
      await this.settings.clearDecision(bot.organizationId, bot.id, tool);
      return bot.id;
    }
    if (decision === 'allow' && listed.definition.traits.perCallOnly) {
      throw new AppError(BotErrors.TOOL_PER_CALL, { detail: `${tool} asks on every call` });
    }
    const permission = BotToolPermissionEntity.decide({
      organizationId: bot.organizationId,
      botId: bot.id,
      tool,
      decision,
      userId: scope.userId,
    });
    if ((await this.settings.setDecision(permission)) === 'missing') {
      throw new AppError(BotErrors.NOT_FOUND);
    }
    return bot.id;
  }
}
