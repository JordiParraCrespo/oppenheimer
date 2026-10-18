import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

export interface BotTurnRepositoryPort {
  /**
   * Stores a sent message as a queued turn and its first message, under a
   * lock on the bot, and stages the turn's job when the bot has no other
   * turn queued or running. `missing` when the bot is gone.
   */
  enqueue(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
  ): Promise<'staged' | 'waiting' | 'missing'>;

  /**
   * `enqueue` for a turn that must happen once, keyed by its `sourceKey`
   * (a routine's run): a key already queued answers that turn instead, so a
   * run dispatched twice queues one turn.
   */
  enqueueOnce(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
  ): Promise<{ outcome: 'staged' | 'waiting' | 'existing' | 'missing'; turnId: string }>;

  /** Whether a turn of the bot whose source key begins with `prefix` is queued or running. */
  hasActiveFrom(organizationId: string, botId: string, prefix: string): Promise<boolean>;

  findOne(scope: AccessScope, botId: string, turnId: string): Promise<Option<BotTurnEntity>>;
  /** The worker's read: by id alone, the job carries nothing else it can trust. */
  findForRun(turnId: string): Promise<Option<BotTurnEntity>>;
  /** These turns of a bot, and any still queued or running, oldest first. */
  findForConversation(
    scope: AccessScope,
    botId: string,
    turnIds: string[],
  ): Promise<BotTurnEntity[]>;

  /**
   * Moves a queued turn to running, conditioned on `queued`. `busy` when the
   * bot already runs one (`UQ_bot_turn_running`), `lost` when the turn moved.
   */
  claim(turn: BotTurnEntity): Promise<'claimed' | 'busy' | 'lost'>;

  /**
   * Stores how it ended, conditioned on the status it was loaded in, and
   * stages the job of the bot's oldest queued turn, under the same lock on
   * the bot `enqueue` takes, so a message sent meanwhile is never left
   * queued with no job. Whether this write won.
   */
  finish(turn: BotTurnEntity, correlationId: string | null): Promise<boolean>;

  /** Stop on a running turn: the worker sees it and aborts. Whether it was still running. */
  requestCancel(turn: BotTurnEntity, now: Date): Promise<boolean>;
  /** Whether Stop was pressed on this turn. */
  isCancelRequested(turnId: string): Promise<boolean>;

  /**
   * Clear history: the bot's turns, and the rest of its conversation through
   * `BotConversationRepositoryPort` on the same transaction, under the lock a
   * send takes. `busy`, and nothing deleted,
   * while one of its turns is queued or running; `missing` when the bot is gone.
   */
  clearConversation(organizationId: string, botId: string): Promise<'cleared' | 'busy' | 'missing'>;
}
