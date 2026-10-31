import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { BotChainState, BotChainVerdict } from '../domain/bot-chain.policy';
import type { BotGoalEntity } from '../domain/bot-goal.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnContext, BotTurnEntity } from '../domain/bot-turn.entity';

/** How queuing a turn another bot asked for went. */
export type BotPeerEnqueueOutcome =
  | { outcome: 'staged' | 'waiting' | 'missing' }
  /** The chain's first turn is gone (its chat was cleared): nothing more is queued for it. */
  | { outcome: 'chain_gone' }
  | { outcome: 'refused'; refusal: string };

/** A steer's message, now the running turn's (`takeSteers`). */
export interface BotSteerTaken {
  /** The queued turn it opened, now deleted. */
  turnId: string;
  messageId: string;
  text: string;
}

export interface BotTurnRepositoryPort {
  /**
   * Stores a sent message as a queued turn and its first message, under a
   * lock on the bot, and stages the turn's job when the bot has no other
   * turn queued or running. `missing` when the bot is gone. The images the
   * message carries are claimed in the same transaction; `attachments_taken`,
   * and nothing written, when one cannot be: another message carries it, it
   * is someone else's upload, or it is past the send window.
   */
  enqueue(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
  ): Promise<'staged' | 'waiting' | 'missing' | 'attachments_taken'>;

  /**
   * `enqueue` for a turn that must happen once, keyed by its `sourceKey`
   * (a routine's run): a key already queued answers that turn instead, so a
   * run dispatched twice queues one turn. With `busyPrefix`, a queued or
   * running turn of the bot whose key begins with it, other than this one,
   * answers `busy` and queues nothing. Both are read under the bot's lock, so
   * two dispatches cannot both miss what the other queued.
   */
  enqueueOnce(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
    busyPrefix: string | null,
  ): Promise<{ outcome: 'staged' | 'waiting' | 'existing' | 'busy' | 'missing'; turnId: string }>;

  /**
   * `enqueue` for a goal's continuation (`25-bots.md` §4.1), with the goal's
   * count claimed in the same transaction: `lost` when the goal was stopped,
   * ended or replaced, or another end claimed the count; `existing` when this
   * continuation was queued already.
   */
  enqueueContinuation(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
    goal: BotGoalEntity,
  ): Promise<'staged' | 'waiting' | 'existing' | 'lost' | 'missing'>;

  /**
   * `enqueue` for a turn another bot's call queues: under a lock on its
   * chain's first turn, so two asks of one chain decide in turn, `decide`
   * reads what the chain holds and the turn is queued only when it allows.
   */
  enqueueFromBot(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
    decide: (state: BotChainState) => BotChainVerdict,
  ): Promise<BotPeerEnqueueOutcome>;

  /**
   * `enqueue` for the answer to an ask. `duplicate`, and nothing written,
   * when that ask's answer is already queued (`UQ_bot_turn_answers`).
   */
  enqueueAnswer(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
  ): Promise<'staged' | 'waiting' | 'missing' | 'duplicate'>;

  findOne(scope: AccessScope, botId: string, turnId: string): Promise<Option<BotTurnEntity>>;
  /** The worker's read: by id alone, the job carries nothing else it can trust. */
  findForRun(turnId: string): Promise<Option<BotTurnEntity>>;
  /** The bot's queued turns whose key begins with `prefix` (a goal's continuations). */
  findQueuedBySourcePrefix(
    organizationId: string,
    botId: string,
    prefix: string,
  ): Promise<BotTurnEntity[]>;
  /**
   * What the model's context held at the end of the bot's newest turn that
   * reported it, for the next turn to be told how full it is. Null before any
   * turn reported one.
   */
  findLastContext(organizationId: string, botId: string): Promise<BotTurnContext | null>;
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
   * stages the job of the bot's next queued turn, under the same lock on
   * the bot `enqueue` takes, so a message sent meanwhile is never left
   * queued with no job; an ask also stages the job that queues its answer
   * on the asker. Whether this write won.
   */
  finish(turn: BotTurnEntity, correlationId: string | null): Promise<boolean>;

  /**
   * Steer (`BotSteerPolicy`): under the bot's lock, every waiting steer of
   * the bot that `takes` allows, oldest first, moved into `running`: its
   * message onto the running turn at `BOT_STEER_HELD_POSITION`, its queued
   * turn deleted, in one transaction, so a Stop, an edit or the worker that
   * would run it sees it either waiting or gone. A steer whose message
   * carries images stays queued: the running turn would not read them.
   */
  takeSteers(
    running: BotTurnEntity,
    takes: (waiting: BotTurnEntity) => boolean,
  ): Promise<BotSteerTaken[]>;

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
