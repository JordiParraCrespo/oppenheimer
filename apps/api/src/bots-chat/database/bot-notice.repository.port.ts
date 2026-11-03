import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotNoticeEntity } from '../domain/bot-notice.entity';

/** One bot's latest notice, with the name of the bot that sent it. */
export interface NamedBotNotice {
  notice: BotNoticeEntity;
  botName: string;
}

export interface BotNoticeRepositoryPort {
  /**
   * Stores the bot's notice in place of its last one, under the notice's
   * own (new) id, with the event that announces it.
   */
  put(notice: BotNoticeEntity): Promise<void>;

  /**
   * The caller's workspace's notices, one per bot at most, newest first, at
   * most `limit`, each with its bot's name, read in the same query.
   */
  findInWorkspace(scope: AccessScope, limit: number): Promise<NamedBotNotice[]>;
}
