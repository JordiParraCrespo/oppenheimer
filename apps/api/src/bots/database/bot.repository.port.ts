import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { BotEntity } from '../domain/bot.entity';
import type { BotDocumentEntity } from '../domain/bot-document.entity';

/** `missing`: the bot was deleted between the read and the write. `group-missing`: so was its new group. */
export type BotWriteOutcome = 'saved' | 'missing' | 'group-missing';

/**
 * Reads take an {@link AccessScope}; writes take a bot the caller already read
 * through one. A write that moves a bot renumbers its group in the same
 * transaction, under a lock on the group's rows.
 */
export interface BotRepositoryPort {
  /** The workspace's bots, by group and position. */
  findAll(scope: AccessScope): Promise<BotEntity[]>;
  /** `None` for a missing or out-of-scope bot. */
  findOneById(scope: AccessScope, id: string): Promise<Option<BotEntity>>;
  /** Every bot name in the workspace, to number a new one. */
  namesIn(scope: AccessScope): Promise<string[]>;
  /** The bot, last in its group, with its first documents and their first revisions. */
  insert(bot: BotEntity, documents: readonly BotDocumentEntity[]): Promise<BotWriteOutcome>;
  save(bot: BotEntity): Promise<BotWriteOutcome>;
  /** The bot, its documents, their history and its memory. */
  delete(bot: BotEntity): Promise<void>;
}
