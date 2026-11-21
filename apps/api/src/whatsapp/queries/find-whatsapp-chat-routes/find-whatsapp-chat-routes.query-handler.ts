import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WhatsappChatRoutesResolver } from '../../application/whatsapp-chat-routes.resolver';
import type { WhatsappChatRouteRow } from '../../domain/whatsapp-chat-route.policy';
import { FindWhatsappChatRoutesQuery } from './find-whatsapp-chat-routes.query';

/**
 * The chats Settings lists for one of the caller's numbers: every chat it saw,
 * newest first, then those it allows with no message kept, each with who
 * answers it (`whatsappChatRoutes`).
 */
@QueryHandler(FindWhatsappChatRoutesQuery)
export class FindWhatsappChatRoutesQueryHandler
  implements IQueryHandler<FindWhatsappChatRoutesQuery, WhatsappChatRouteRow[]>
{
  constructor(private readonly routes: WhatsappChatRoutesResolver) {}

  async execute({
    scope,
    accountId,
  }: FindWhatsappChatRoutesQuery): Promise<WhatsappChatRouteRow[]> {
    return (await this.routes.of(scope, accountId)).rows;
  }
}
