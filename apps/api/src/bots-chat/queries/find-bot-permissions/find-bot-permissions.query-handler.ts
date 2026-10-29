import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotToolboxFactory } from '../../application/bot-toolbox.factory';
import {
  BOT_PERMISSION_RULE_REPOSITORY,
  BOT_TOOL_PERMISSION_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotPermissionRuleRepositoryPort } from '../../database/bot-permission-rule.repository.port';
import type { BotToolPermissionRepositoryPort } from '../../database/bot-tool-permission.repository.port';
import {
  type BotPermissionsView,
  permissionsOf,
  toolRows,
} from '../../domain/bot-tool-permission.policy';
import { FindBotPermissionsQuery } from './find-bot-permissions.query';

/**
 * A bot's Settings → Permissions (`25-bots.md` §5): every tool the catalog
 * has, with where it stands for this bot (its owner's setting, else the
 * preset's default), the standing grants and the rules. A bot in another
 * workspace is one that does not exist (`BOTS_001`).
 */
@QueryHandler(FindBotPermissionsQuery)
export class FindBotPermissionsQueryHandler
  implements IQueryHandler<FindBotPermissionsQuery, BotPermissionsView>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_TOOL_PERMISSION_REPOSITORY)
    private readonly settings: BotToolPermissionRepositoryPort,
    @Inject(BOT_PERMISSION_RULE_REPOSITORY) private readonly rules: BotPermissionRuleRepositoryPort,
    private readonly toolbox: BotToolboxFactory,
  ) {}

  async execute({ scope, botId }: FindBotPermissionsQuery): Promise<BotPermissionsView> {
    const bot = await this.lookup.bot(scope, botId);
    const [settings, rules] = await Promise.all([
      this.settings.findAll(scope, bot.id),
      this.rules.findAll(scope, bot.id),
    ]);
    const listed = this.toolbox.listed().map(({ group, definition }) => ({
      group,
      description: definition.description,
      traits: definition.traits,
    }));
    return {
      preset: bot.permission,
      rows: toolRows(listed, permissionsOf(settings, rules), bot.permission),
      grants: settings.filter((setting) => setting.subject !== null),
      rules,
    };
  }
}
