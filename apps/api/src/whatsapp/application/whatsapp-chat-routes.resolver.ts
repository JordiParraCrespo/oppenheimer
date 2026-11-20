import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { WHATSAPP_CHAT_ROUTES_MAX } from '@oppenheimer/shared';
import type { WhatsappChatGrantRepositoryPort } from '../database/whatsapp-chat-grant.repository.port';
import type { WhatsappMessageRepositoryPort } from '../database/whatsapp-message.repository.port';
import type { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import {
  type WhatsappChatRouteRow,
  whatsappChatRoutes,
} from '../domain/whatsapp-chat-route.policy';
import { WHATSAPP_CHAT_GRANT_REPOSITORY, WHATSAPP_MESSAGE_REPOSITORY } from '../whatsapp.di-tokens';
import { WhatsappChatResolver } from './whatsapp-chat.resolver';

/**
 * One of the caller's numbers and its chats as Settings lists them: the
 * `WHATSAPP_CHAT_ROUTES_MAX` it saw most recently and every one it allows,
 * each with its grant. What both the list and a change of who answers read.
 */
@Injectable()
export class WhatsappChatRoutesResolver {
  constructor(
    private readonly chats: WhatsappChatResolver,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    @Inject(WHATSAPP_CHAT_GRANT_REPOSITORY)
    private readonly grants: WhatsappChatGrantRepositoryPort,
  ) {}

  async of(
    scope: AccessScope,
    accountId: string,
  ): Promise<{ account: WhatsappAccountEntity; rows: WhatsappChatRouteRow[] }> {
    const account = await this.chats.account(scope, accountId);
    const ref = { organizationId: account.organizationId, accountId: account.id };
    const [seen, grants] = await Promise.all([
      this.messages.findChats(ref, WHATSAPP_CHAT_ROUTES_MAX),
      this.grants.findAll(ref),
    ]);
    return { account, rows: whatsappChatRoutes(account, seen, grants) };
  }
}
