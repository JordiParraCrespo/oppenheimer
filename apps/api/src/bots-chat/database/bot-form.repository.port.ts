import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { BotFormEntity } from '../domain/bot-form.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

export interface BotFormRepositoryPort {
  /**
   * Stores a new pending form, unless the bot already has a card waiting, of
   * any kind (a form, questions, an approval): then nothing is written, and
   * the answer is that card's line.
   */
  insertPending(form: BotFormEntity): Promise<'inserted' | { waiting: string }>;

  /** One form of a bot in the caller's workspace. */
  findOne(scope: AccessScope, botId: string, formId: string): Promise<Option<BotFormEntity>>;
  /** The bot's waiting form, read by its workspace (the chat, a new message). */
  findPending(organizationId: string, botId: string): Promise<Option<BotFormEntity>>;
  /** The bots with a form pending, on the bots the scope may read. */
  findPendingBotIds(scope: AccessScope): Promise<string[]>;

  /**
   * Stores a move, conditioned on the status the form was loaded in, with
   * the turn that reports back in the same transaction. Whether this write
   * won: `false` means another got there first, and nothing was written.
   */
  saveTransition(
    form: BotFormEntity,
    continuation?: { turn: BotTurnEntity; opening: BotMessageEntity },
    correlationId?: string | null,
  ): Promise<boolean>;
}
