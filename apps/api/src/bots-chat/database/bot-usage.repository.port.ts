import type { BotUsage } from '@oppenheimer/shared';
import type { BotModelCall } from '../domain/bot-usage.policy';

export interface BotUsageRepositoryPort {
  /** Records one call a bot made outside its turns. */
  recordCall(call: BotModelCall): Promise<void>;
  /** What the bot's chat has spent: its turns that ran, by model, and its other calls by purpose. */
  findForBot(organizationId: string, botId: string): Promise<BotUsage>;
}
