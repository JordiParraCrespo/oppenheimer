import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TelegramChatResolver } from '../../application/telegram-chat.resolver';
import type { TelegramMessageRepositoryPort } from '../../database/telegram-message.repository.port';
import type { TelegramMessage } from '../../domain/telegram-message.types';
import { TELEGRAM_MESSAGE_REPOSITORY } from '../../telegram.di-tokens';
import { SearchTelegramMessagesQuery } from './search-telegram-messages.query';

/** Messages on one of the caller's Telegram bots whose text holds the words, newest first. */
@QueryHandler(SearchTelegramMessagesQuery)
export class SearchTelegramMessagesQueryHandler
  implements IQueryHandler<SearchTelegramMessagesQuery, TelegramMessage[]>
{
  constructor(
    private readonly resolver: TelegramChatResolver,
    @Inject(TELEGRAM_MESSAGE_REPOSITORY)
    private readonly messages: TelegramMessageRepositoryPort,
  ) {}

  async execute({
    scope,
    accountId,
    query,
    limit,
  }: SearchTelegramMessagesQuery): Promise<TelegramMessage[]> {
    const account = await this.resolver.account(scope, accountId);
    return this.messages.search(
      { organizationId: account.organizationId, accountId: account.id },
      query,
      limit,
    );
  }
}
