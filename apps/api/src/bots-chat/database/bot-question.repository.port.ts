import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotQuestionEntity } from '../domain/bot-question.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

export interface BotQuestionRepositoryPort {
  /**
   * Stores a new pending card of questions, unless the bot already has a
   * card waiting, questions or an approval: then nothing is written, and the
   * answer is that card's line.
   */
  insertPending(question: BotQuestionEntity): Promise<'inserted' | { waiting: string }>;

  /** One card of a bot in the caller's workspace. */
  findOne(
    scope: AccessScope,
    botId: string,
    questionId: string,
  ): Promise<Option<BotQuestionEntity>>;
  /** The bot's waiting card, read by its workspace (the chat, a new message). */
  findPending(organizationId: string, botId: string): Promise<Option<BotQuestionEntity>>;

  /**
   * Stores a move, conditioned on the status the card was loaded in, with
   * the turn that reports back in the same transaction. Whether this write
   * won: `false` means another got there first, and nothing was written.
   */
  saveTransition(
    question: BotQuestionEntity,
    continuation?: { turn: BotTurnEntity; opening: BotMessageEntity },
    correlationId?: string | null,
  ): Promise<boolean>;
}
