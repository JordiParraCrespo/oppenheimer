import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WhatsappChatResolver } from '../../application/whatsapp-chat.resolver';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import type { WhatsappChat } from '../../domain/whatsapp-message.types';
import { WHATSAPP_MESSAGE_REPOSITORY } from '../../whatsapp.di-tokens';
import { FindWhatsappChatsQuery } from './find-whatsapp-chats.query';

/** One of the caller's numbers' chats, most recently active first, each with its last message. */
@QueryHandler(FindWhatsappChatsQuery)
export class FindWhatsappChatsQueryHandler
  implements IQueryHandler<FindWhatsappChatsQuery, WhatsappChat[]>
{
  constructor(
    private readonly resolver: WhatsappChatResolver,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
  ) {}

  async execute({ scope, accountId, limit }: FindWhatsappChatsQuery): Promise<WhatsappChat[]> {
    const account = await this.resolver.account(scope, accountId);
    return this.messages.findChats(
      { organizationId: account.organizationId, accountId: account.id },
      limit,
    );
  }
}
