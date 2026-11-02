import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WhatsappChatResolver } from '../../application/whatsapp-chat.resolver';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import type { WhatsappMessage } from '../../domain/whatsapp-message.types';
import { WHATSAPP_MESSAGE_REPOSITORY } from '../../whatsapp.di-tokens';
import { SearchWhatsappMessagesQuery } from './search-whatsapp-messages.query';

/** Messages on one of the caller's numbers whose text holds the words, newest first. */
@QueryHandler(SearchWhatsappMessagesQuery)
export class SearchWhatsappMessagesQueryHandler
  implements IQueryHandler<SearchWhatsappMessagesQuery, WhatsappMessage[]>
{
  constructor(
    private readonly resolver: WhatsappChatResolver,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
  ) {}

  async execute({
    scope,
    accountId,
    query,
    limit,
  }: SearchWhatsappMessagesQuery): Promise<WhatsappMessage[]> {
    const account = await this.resolver.account(scope, accountId);
    return this.messages.search(
      { organizationId: account.organizationId, accountId: account.id },
      query,
      limit,
    );
  }
}
