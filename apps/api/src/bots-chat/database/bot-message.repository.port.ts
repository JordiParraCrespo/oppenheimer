import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotMessageEntity } from '../domain/bot-message.entity';

export interface BotMessageRepositoryPort {
  /**
   * Stores a message of a running turn; a user or assistant message also
   * becomes the bot's last message, for the sidebar.
   */
  insert(message: BotMessageEntity): Promise<void>;
  /** An activity line's steps, as they grow. */
  saveSteps(message: BotMessageEntity): Promise<void>;
  /** The bot's newest `limit` messages, oldest first. */
  findConversation(scope: AccessScope, botId: string, limit: number): Promise<BotMessageEntity[]>;
  /** The message that opened a turn: what you sent it, or the event Oppenheimer told it. */
  findOpening(organizationId: string, turnId: string): Promise<BotMessageEntity | null>;
  /** What a turn reads back: the bot's newest `limit` messages before `turnId`'s, oldest first. */
  findHistory(
    organizationId: string,
    botId: string,
    turnId: string,
    limit: number,
  ): Promise<BotMessageEntity[]>;
}
