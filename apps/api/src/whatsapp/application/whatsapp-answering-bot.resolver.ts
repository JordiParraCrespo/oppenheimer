import { Inject, Injectable } from '@nestjs/common';
import type { WhatsappAccountRepositoryPort } from '../database/whatsapp-account.repository.port';
import type { WhatsappChatGrantRepositoryPort } from '../database/whatsapp-chat-grant.repository.port';
import type { WhatsappMessageRepositoryPort } from '../database/whatsapp-message.repository.port';
import type { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import {
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_CHAT_GRANT_REPOSITORY,
  WHATSAPP_MESSAGE_REPOSITORY,
} from '../whatsapp.di-tokens';

/** A chat a bot still answers on a connected number, and what the chat is. */
export interface WhatsappAnsweredChat {
  account: WhatsappAccountEntity;
  /** A chat the number allows: its kind and name. Absent for the owner's own chat. */
  chat?: { chatKind: 'direct' | 'group'; chatName: string | null };
}

/**
 * Whether a bot may still act in a chat as the number: the number connected
 * with a confirmed owner, and the bot the chat's bot (in the owner's own
 * chat, its latest switch by name, else the number's default; in a chat the
 * number allows, the bot chosen for it, else the default). Null otherwise:
 * the owner switched, changed a bot, stopped allowing the chat or unlinked
 * the number while the turn ran.
 */
@Injectable()
export class WhatsappAnsweringBotResolver {
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    @Inject(WHATSAPP_CHAT_GRANT_REPOSITORY)
    private readonly grants: WhatsappChatGrantRepositoryPort,
  ) {}

  async answering(where: {
    organizationId: string;
    accountId: string;
    chatId: string;
    botId: string;
  }): Promise<WhatsappAnsweredChat | null> {
    const found = await this.accounts.findByIdForSystem(where.organizationId, where.accountId);
    if (found.isNone()) return null;
    const account = found.unwrap();
    if (!account.isConnected || !account.ownerPhone) return null;
    const ref = { organizationId: account.organizationId, accountId: account.id };
    if (account.isOwner(where.chatId)) {
      const botId =
        (await this.messages.findSwitchedBot(ref, where.chatId)) ?? account.answeringBotId;
      return botId === where.botId ? { account } : null;
    }
    const grant = await this.grants.findByChat(ref, where.chatId);
    if (grant.isNone()) return null;
    const { botId, chatKind, chatName } = grant.unwrap();
    if ((botId ?? account.answeringBotId) !== where.botId) return null;
    return { account, chat: { chatKind, chatName } };
  }
}
