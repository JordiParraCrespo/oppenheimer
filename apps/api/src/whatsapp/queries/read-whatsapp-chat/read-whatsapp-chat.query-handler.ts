import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WhatsappChatResolver } from '../../application/whatsapp-chat.resolver';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import { WHATSAPP_MESSAGE_REPOSITORY } from '../../whatsapp.di-tokens';
import { ReadWhatsappChatQuery, type WhatsappChatRead } from './read-whatsapp-chat.query';

/** One chat of one of the caller's numbers, by its id or name, and its last messages. */
@QueryHandler(ReadWhatsappChatQuery)
export class ReadWhatsappChatQueryHandler
  implements IQueryHandler<ReadWhatsappChatQuery, WhatsappChatRead>
{
  constructor(
    private readonly resolver: WhatsappChatResolver,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
  ) {}

  async execute(query: ReadWhatsappChatQuery): Promise<WhatsappChatRead> {
    const account = await this.resolver.account(query.scope, query.accountId);
    const chat = await this.resolver.chat(account, query.chat, { allowNew: query.targetOnly });
    if (query.targetOnly || chat.isNew) return { accountLabel: account.label, chat, messages: [] };
    const newestFirst = await this.messages.findInChat(
      { organizationId: account.organizationId, accountId: account.id },
      chat.chatId,
      query.limit,
      query.before,
    );
    return { accountLabel: account.label, chat, messages: newestFirst.reverse() };
  }
}
