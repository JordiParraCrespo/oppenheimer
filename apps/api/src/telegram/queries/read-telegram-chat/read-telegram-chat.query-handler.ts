import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TelegramChatResolver } from '../../application/telegram-chat.resolver';
import type { TelegramMessageRepositoryPort } from '../../database/telegram-message.repository.port';
import { TELEGRAM_MESSAGE_REPOSITORY } from '../../telegram.di-tokens';
import { ReadTelegramChatQuery, type TelegramChatRead } from './read-telegram-chat.query';

/** One chat of one of the caller's Telegram bots, by its id or name, and its last messages. */
@QueryHandler(ReadTelegramChatQuery)
export class ReadTelegramChatQueryHandler
  implements IQueryHandler<ReadTelegramChatQuery, TelegramChatRead>
{
  constructor(
    private readonly resolver: TelegramChatResolver,
    @Inject(TELEGRAM_MESSAGE_REPOSITORY)
    private readonly messages: TelegramMessageRepositoryPort,
  ) {}

  async execute(query: ReadTelegramChatQuery): Promise<TelegramChatRead> {
    const account = await this.resolver.account(query.scope, query.accountId);
    const chat = await this.resolver.chat(account, query.chat);
    if (query.targetOnly) return { accountLabel: account.label, chat, messages: [] };
    const newestFirst = await this.messages.findInChat(
      { organizationId: account.organizationId, accountId: account.id },
      chat.chatId,
      query.limit,
      query.before,
    );
    return { accountLabel: account.label, chat, messages: newestFirst.reverse() };
  }
}
