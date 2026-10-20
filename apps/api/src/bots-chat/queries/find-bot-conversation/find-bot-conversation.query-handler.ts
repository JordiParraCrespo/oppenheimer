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
  turns: BotTurnEntity[];
  /** Every message the chat holds, not only these: Settings' history line. */
  messageCount: number;
}

/**
 * A bot's chat as the console draws it: its newest messages, oldest first,
 * the turns they belong to (how each ended, why one failed), and any turn
 * still queued or running, which the chat shows as working; and how many
 * messages it holds in all, past the window.
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

  async execute({ scope, botId, limit }: FindBotConversationQuery): Promise<BotConversation> {
    await this.lookup.bot(scope, botId);
    const messages = await this.messages.findConversation(scope, botId, limit);
    const turnIds = [
      ...new Set(messages.flatMap((message) => (message.turnId === null ? [] : [message.turnId]))),
    ];
    const [turns, messageCount] = await Promise.all([
      this.turns.findForConversation(scope, botId, turnIds),
      this.messages.countConversation(scope, botId),
    ]);
    return { messages, turns, messageCount };
  }
}
