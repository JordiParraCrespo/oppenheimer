import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_MESSAGE_REPOSITORY, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotMessageEntity } from '../../domain/bot-message.entity';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import { FindBotConversationQuery } from './find-bot-conversation.query';

export interface BotConversation {
  messages: BotMessageEntity[];
  /** The chat holds messages older than these: the next page is before the first. */
  hasOlder: boolean;
  turns: BotTurnEntity[];
  /** Every message the chat holds, not only these: Settings' history line. */
  messageCount: number;
  /** For each turn still queued or running, the blocks of text it has stored in all. */
  storedTextBlocks: Map<string, number>;
}

/**
 * A bot's chat as the console draws it: its newest messages, oldest first
 * (or, with `before`, the page just older than that message, for a chat
 * scrolled up past its window), whether older ones remain,
 * the turns they belong to (how each ended, why one failed), and any turn
 * still queued or running, which the chat shows as working; and how many
 * messages it holds in all, past the window. For a turn still running, how
 * many blocks of text it stored in all: its streamed text is numbered by
 * that, and a long turn's first blocks can fall outside the window.
 */
@QueryHandler(FindBotConversationQuery)
export class FindBotConversationQueryHandler
  implements IQueryHandler<FindBotConversationQuery, BotConversation>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
  ) {}

  async execute({
    scope,
    botId,
    limit,
    before,
  }: FindBotConversationQuery): Promise<BotConversation> {
    await this.lookup.bot(scope, botId);
    // One more than asked for, to tell whether an older page remains.
    const read = await this.messages.findConversation(scope, botId, limit + 1, before);
    const hasOlder = read.length > limit;
    const messages = hasOlder ? read.slice(1) : read;
    const turnIds = [
      ...new Set(messages.flatMap((message) => (message.turnId === null ? [] : [message.turnId]))),
    ];
    const [turns, messageCount] = await Promise.all([
      this.turns.findForConversation(scope, botId, turnIds),
      this.messages.countConversation(scope, botId),
    ]);
    const active = turns.filter((turn) => turn.status === 'queued' || turn.status === 'running');
    const counted = await this.messages.countTextBlocks(
      scope,
      active.map((turn) => turn.id),
    );
    const storedTextBlocks = new Map(active.map((turn) => [turn.id, counted.get(turn.id) ?? 0]));
    return { messages, hasOlder, turns, messageCount, storedTextBlocks };
  }
}
