import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TelegramChatResolver } from '../../application/telegram-chat.resolver';
import type { TelegramMessageRepositoryPort } from '../../database/telegram-message.repository.port';
import type { TelegramChat } from '../../domain/telegram-message.types';
import { TELEGRAM_MESSAGE_REPOSITORY } from '../../telegram.di-tokens';
import { FindTelegramChatsQuery } from './find-telegram-chats.query';

/** One of the caller's Telegram bots' chats, most recently active first, each with its last message. */
@QueryHandler(FindTelegramChatsQuery)
export class FindTelegramChatsQueryHandler
  implements IQueryHandler<FindTelegramChatsQuery, TelegramChat[]>
{
  constructor(
    private readonly resolver: TelegramChatResolver,
    @Inject(TELEGRAM_MESSAGE_REPOSITORY)
    private readonly messages: TelegramMessageRepositoryPort,
  ) {}

  async execute({ scope, accountId, limit }: FindTelegramChatsQuery): Promise<TelegramChat[]> {
    const account = await this.resolver.account(scope, accountId);
    return this.messages.findChats(
      { organizationId: account.organizationId, accountId: account.id },
      limit,
    );
  }
}
