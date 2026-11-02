import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { SummarizableMessage } from '../domain/bot-summary.policy';

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
  /** An activity line's steps, as they grow. */
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
  /** The bot's newest `limit` messages, oldest first. */
  findConversation(scope: AccessScope, botId: string, limit: number): Promise<BotMessageEntity[]>;
  /**
   * The person's and the bot's messages whose words match `query`
   * (Postgres web-search syntax over the `simple` configuration, so no
   * language is assumed), best matches first, then newest; up to `limit`.
   * Activity lines and events are not searched.
   */
  search(
    scope: AccessScope,
    botId: string,
    query: string,
    limit: number,
  ): Promise<BotMessageEntity[]>;
  /** How many messages the chat holds in all: yours, the bot's and events, not activity lines. */
  countConversation(scope: AccessScope, botId: string): Promise<number>;
  /**
   * How many blocks of text each of these turns has stored, in all: its
   * assistant messages with words (an image the bot showed has none). A
   * running turn's streamed text is numbered by it, and a long turn's
   * first blocks can fall outside the conversation's window.
   */
  countTextBlocks(scope: AccessScope, turnIds: readonly string[]): Promise<Map<string, number>>;
  /**
   * One page of the whole chat for an export, oldest first: up to `limit`
   * messages after `after` (the last of the page before; null from the start).
   */
  findExportPage(
    scope: AccessScope,
    botId: string,
    after: BotMessageEntity | null,
    limit: number,
  ): Promise<BotMessageEntity[]>;
  /** The message that opened a turn: what you sent it, or the event Oppenheimer told it. */
  findOpening(organizationId: string, turnId: string): Promise<BotMessageEntity | null>;
  /** A turn's own text, in the order the bot wrote it: what an ask's answer is drawn from. */
  findTurnTexts(organizationId: string, turnId: string): Promise<string[]>;
  /**
   * What a turn reads back: the bot's newest `limit` messages before
   * `turnId`'s and after the message `afterMessageId` (the summary's cutoff;
   * null for none), oldest first. Activity lines are not read.
   */
  findHistory(
    organizationId: string,
    botId: string,
    turnId: string,
    afterMessageId: string | null,
    limit: number,
  ): Promise<BotMessageEntity[]>;
  /**
   * What the summary does not cover yet: the bot's oldest `limit` messages
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
