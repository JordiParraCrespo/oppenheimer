import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotNoticeEntity } from '../domain/bot-notice.entity';

export interface BotNoticeRepositoryPort {
  /**
   * Stores the bot's notice in place of its last one, under the notice's
   * own (new) id, with the event that announces it.
   */
  put(notice: BotNoticeEntity): Promise<void>;

  /** The caller's workspace's notices, one per bot at most, newest first, at most `limit`. */
  findInWorkspace(scope: AccessScope, limit: number): Promise<BotNoticeEntity[]>;
}
