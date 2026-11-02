import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { BotEntity } from '../domain/bot.entity';

/**
 * The bot a route under `/bots/:id` acts on, for the modules that serve some
 * of those routes (the chat, `bots-chat`): read through the caller's scope,
 * so a bot in another workspace is one that does not exist (`BOTS_001`).
 */
export interface BotLookupPort {
  bot(scope: AccessScope, botId: string): Promise<BotEntity>;
}
