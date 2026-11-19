import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WhatsappChatResolver } from '../../application/whatsapp-chat.resolver';
import type { WhatsappChatGrantRepositoryPort } from '../../database/whatsapp-chat-grant.repository.port';
import type { WhatsappChatGrantEntity } from '../../domain/whatsapp-chat-grant.entity';
import { WHATSAPP_CHAT_GRANT_REPOSITORY } from '../../whatsapp.di-tokens';
import { FindWhatsappChatGrantsQuery } from './find-whatsapp-chat-grants.query';

/** The chats one of the caller's numbers allows, the oldest first. */
@QueryHandler(FindWhatsappChatGrantsQuery)
export class FindWhatsappChatGrantsQueryHandler
  implements IQueryHandler<FindWhatsappChatGrantsQuery, WhatsappChatGrantEntity[]>
{
  constructor(
    private readonly chats: WhatsappChatResolver,
    @Inject(WHATSAPP_CHAT_GRANT_REPOSITORY)
    private readonly grants: WhatsappChatGrantRepositoryPort,
  ) {}

  async execute({
    scope,
    accountId,
  }: FindWhatsappChatGrantsQuery): Promise<WhatsappChatGrantEntity[]> {
    const account = await this.chats.account(scope, accountId);
    return this.grants.findAll({ organizationId: account.organizationId, accountId: account.id });
  }
}
