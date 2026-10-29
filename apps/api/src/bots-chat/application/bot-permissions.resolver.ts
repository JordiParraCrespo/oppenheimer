import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_PERMISSION_RULE_REPOSITORY,
  BOT_TOOL_PERMISSION_REPOSITORY,
} from '../bots-chat.di-tokens';
import type { BotPermissionRuleRepositoryPort } from '../database/bot-permission-rule.repository.port';
import type { BotToolPermissionRepositoryPort } from '../database/bot-tool-permission.repository.port';
import { type BotPermissions, permissionsOf } from '../domain/bot-tool-permission.policy';

/**
 * What a bot's owner set for its tools (`25-bots.md` §5), read in the bot's
 * workspace when a turn starts or an approved call runs: the settings, the
 * standing grants and the rules, as one value the policy reads.
 */
@Injectable()
export class BotPermissionsResolver {
  constructor(
    @Inject(BOT_TOOL_PERMISSION_REPOSITORY)
    private readonly settings: BotToolPermissionRepositoryPort,
    @Inject(BOT_PERMISSION_RULE_REPOSITORY)
    private readonly rules: BotPermissionRuleRepositoryPort,
  ) {}

  async forBot(organizationId: string, botId: string): Promise<BotPermissions> {
    const [settings, rules] = await Promise.all([
      this.settings.findAllForTurn(organizationId, botId),
      this.rules.findAllForTurn(organizationId, botId),
    ]);
    return permissionsOf(settings, rules);
  }
}
