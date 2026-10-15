import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_MESSAGE_REPOSITORY, BOT_TURN_REPOSITORY } from '../../bots.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotMessageEntity } from '../../domain/bot-message.entity';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import { FindBotConversationQuery } from './find-bot-conversation.query';

export interface BotConversation {
  messages: BotMessageEntity[];
  turns: BotTurnEntity[];
}

/**
 * A bot's chat as the console draws it: its newest messages, oldest first,
 * the turns they belong to (how each ended, why one failed), and any turn
 * still queued or running, which the chat shows as working.
 */
@QueryHandler(FindBotConversationQuery)
export class FindBotConversationQueryHandler
  implements IQueryHandler<FindBotConversationQuery, BotConversation>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
  ) {}

  async execute({ scope, botId, limit }: FindBotConversationQuery): Promise<BotConversation> {
    await this.lookup.bot(scope, botId);
    const messages = await this.messages.findConversation(scope, botId, limit);
    const turnIds = [...new Set(messages.map((message) => message.turnId))];
    const turns = await this.turns.findForConversation(scope, botId, turnIds);
    return { messages, turns };
  }
}
