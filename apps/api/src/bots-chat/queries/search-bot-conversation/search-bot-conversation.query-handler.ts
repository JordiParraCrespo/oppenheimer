import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BOT_MESSAGE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotMessageEntity } from '../../domain/bot-message.entity';
import { SearchBotConversationQuery } from './search-bot-conversation.query';

/**
 * A bot's chat, searched for words (`search_chat`, `25-bots.md` §4.1): the
 * person's and the bot's messages that match, best first, read in the
 * caller's scope, so a bot finds only its own chat in its own workspace.
 */
@QueryHandler(SearchBotConversationQuery)
export class SearchBotConversationQueryHandler
  implements IQueryHandler<SearchBotConversationQuery, BotMessageEntity[]>
{
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
  ) {}

  execute({ scope, botId, query, limit }: SearchBotConversationQuery): Promise<BotMessageEntity[]> {
    return this.messages.search(scope, botId, query, limit);
  }
}
