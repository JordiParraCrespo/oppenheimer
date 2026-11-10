import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { SummarizableMessage } from '../domain/bot-summary.policy';

/**
 * Postgres refused what a line's steps hold (an SQLSTATE class 22 data
 * exception), not the write itself: what `saveSteps` throws then, so the
 * turn can fail that call alone (#728).
 */
export class UnstorableStepsError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = 'UnstorableStepsError';
  }
}

export interface BotMessageRepositoryPort {
  /**
   * Stores a message of a running turn; a user or assistant message also
   * becomes the bot's last message, for the sidebar.
   */
  insert(message: BotMessageEntity): Promise<void>;
  /**
   * Stores a line keyed by what reported it (its id is the event's) once,
   * however often it is delivered, at its own `createdAt`, and only while its
   * bot exists; whether this call stored it.
   */
  insertOnce(message: BotMessageEntity): Promise<boolean>;
  /**
   * An activity line's steps, as they grow. Throws `UnstorableStepsError`
   * when Postgres refuses what they hold; any other failure as it came.
   */
  saveSteps(message: BotMessageEntity): Promise<void>;
  /**
   * A steer the running turn took (`BotTurnRepositoryPort.takeSteers`), put
   * where the turn delivered it: at `position`, as of `at`, which is what
   * the chat orders it by. Only while it is still that turn's.
   */
  placeSteer(
    turn: { organizationId: string; id: string },
    steer: { messageId: string; position: number },
    at: Date,
  ): Promise<void>;
  /**
   * A conversation's newest `limit` messages, oldest first: the console
   * chat's when `conversationId` is the bot's id.
   */
  findConversation(
    scope: AccessScope,
    conversationId: string,
    limit: number,
  ): Promise<BotMessageEntity[]>;
  /**
   * The person's and the bot's messages whose words match `query`
   * (Postgres web-search syntax over the `simple` configuration, so no
   * language is assumed), best matches first, then newest; up to `limit`.
   * Activity lines and events are not searched. One conversation's.
   */
  search(
    scope: AccessScope,
    conversationId: string,
    query: string,
    limit: number,
  ): Promise<BotMessageEntity[]>;
  /** How many messages a conversation holds in all: yours, the bot's and events, not activity lines. */
  countConversation(scope: AccessScope, conversationId: string): Promise<number>;
  /**
   * How many blocks of text each of these turns has stored, in all: its
   * assistant messages with words (an image the bot showed has none). A
   * running turn's streamed text is numbered by it, and a long turn's
   * first blocks can fall outside the conversation's window.
   */
  countTextBlocks(scope: AccessScope, turnIds: readonly string[]): Promise<Map<string, number>>;
  /**
   * One page of a whole conversation for an export, oldest first: up to
   * `limit` messages after `after` (the last of the page before; null from
   * the start).
   */
  findExportPage(
    scope: AccessScope,
    conversationId: string,
    after: BotMessageEntity | null,
    limit: number,
  ): Promise<BotMessageEntity[]>;
  /** The message that opened a turn: what you sent it, or the event Oppenheimer told it. */
  findOpening(organizationId: string, turnId: string): Promise<BotMessageEntity | null>;
  /** A turn's own text, in the order the bot wrote it: what an ask's answer is drawn from. */
  findTurnTexts(organizationId: string, turnId: string): Promise<string[]>;
  /** Whether a turn called any tool: what a goal counts as progress (`BotGoalEntity.account`). */
  turnCalledTools(organizationId: string, turnId: string): Promise<boolean>;
  /**
   * What a turn reads back: its conversation's newest `limit` messages
   * before `turnId`'s and after the message `afterMessageId` (the summary's
   * cutoff; null for none), oldest first. Activity lines are not read.
   */
  findHistory(
    organizationId: string,
    conversationId: string,
    turnId: string,
    afterMessageId: string | null,
    limit: number,
  ): Promise<BotMessageEntity[]>;
  /**
   * What a dream checks the memory against: the bot's newest `limit`
   * messages, oldest first, activity lines left out.
   */
  findRecent(organizationId: string, botId: string, limit: number): Promise<BotMessageEntity[]>;
  /**
   * What the summary does not cover yet: the console chat's oldest `limit` messages
   * after `afterMessageId` (null for all of them), oldest first, activity
   * lines left out, each with whether its turn has ended.
   */
  findUncovered(
    organizationId: string,
    botId: string,
    afterMessageId: string | null,
    limit: number,
  ): Promise<SummarizableMessage[]>;
}
