import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { BotPermissionRuleEntity } from '../domain/bot-permission-rule.entity';

export interface BotPermissionRuleRepositoryPort {
  /** A bot's rules, oldest first, as its owner's workspace reads them. */
  findAll(scope: AccessScope, botId: string): Promise<BotPermissionRuleEntity[]>;
  /** The same, for a turn the worker runs in the bot's workspace. */
  findAllForTurn(organizationId: string, botId: string): Promise<BotPermissionRuleEntity[]>;
  /** The rule, unless the bot already holds `max`: counted under a lock on the bot. */
  insert(rule: BotPermissionRuleEntity, max: number): Promise<'inserted' | 'full' | 'missing'>;
  /** Removes one rule; whether there was one to remove. */
  delete(scope: AccessScope, botId: string, ruleId: string): Promise<boolean>;
}
