import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotPermission } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { BotEntity } from '../domain/bot.entity';
import type { BotDocumentEntity } from '../domain/bot-document.entity';

/**
 * `missing`: the bot was deleted between the read and the write. `group-missing`: so was its new group.
 * `taken`: a creation's idempotency key already made a bot, so this one wrote nothing.
 * `creator-changed`: the bot creating it was deleted, or its level changed, since it was checked.
 */
export type BotWriteOutcome = 'saved' | 'missing' | 'group-missing' | 'taken' | 'creator-changed';

/** The creating bot as the caller checked it: the write holds only while it is still so. */
export interface BotCreatorCheck {
  botId: string;
  permission: BotPermission;
}

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
  /**
   * The workspace's bot, for a turn the worker runs: the workspace is the
   * turn's, and no person is asking. `None` for a bot of another workspace.
   */
  findForTurn(organizationId: string, botId: string): Promise<Option<BotEntity>>;
  /** The bot a creation with this idempotency key made; `None` when none did. */
  findOneByIdempotencyKey(scope: AccessScope, key: string): Promise<Option<BotEntity>>;
  /** Every bot name in the workspace, to number a new one. */
  namesIn(scope: AccessScope): Promise<string[]>;
  /**
   * The bot, last in its group, with its first documents and their first
   * revisions; `taken`, writing nothing, when its idempotency key already made one.
   * With `creator`, the creating bot's row is locked for the write and must
   * still hold the level checked; `creator-changed`, writing nothing, when not.
   */
  insert(
    bot: BotEntity,
    documents: readonly BotDocumentEntity[],
    creator?: BotCreatorCheck,
  ): Promise<BotWriteOutcome>;
  save(bot: BotEntity): Promise<BotWriteOutcome>;
  /** The bot, its documents, their history and its memory. */
  delete(bot: BotEntity): Promise<void>;
}
