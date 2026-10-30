import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { WhatsappAccountRepositoryPort } from '../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../database/whatsapp-message.repository.port';
import { WhatsappErrors } from '../domain/whatsapp.errors';
import type { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import type { WhatsappChat } from '../domain/whatsapp-message.types';
import { pickWhatsappChat } from '../domain/whatsapp-send.policy';
import { WHATSAPP_ACCOUNT_REPOSITORY, WHATSAPP_MESSAGE_REPOSITORY } from '../whatsapp.di-tokens';

/** Chats a name is looked for among: the number's most recently active. */
export const WHATSAPP_CHATS_SCANNED = 500;

/** Where a message goes: a chat the number has, or a new direct chat with a phone number. */
export interface WhatsappChatTarget {
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
  /** The number has no message in this chat yet. */
  isNew: boolean;
}

/**
 * One of the caller's numbers, and a chat on it from what a bot wrote: a
 * chat's id, a person's or group's name, or (to start a chat) a phone number
 * in international form.
 */
@Injectable()
export class WhatsappChatResolver {
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
  ) {}

  async account(scope: AccessScope, accountId: string): Promise<WhatsappAccountEntity> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) throw new AppError(WhatsappErrors.ACCOUNT_NOT_FOUND);
    return found.unwrap();
  }

  async chat(
    account: WhatsappAccountEntity,
    wanted: string,
    options: { allowNew: boolean },
  ): Promise<WhatsappChatTarget> {
    const chats = await this.messages.findChats(
      { organizationId: account.organizationId, accountId: account.id },
      WHATSAPP_CHATS_SCANNED,
    );
    const picked = pickWhatsappChat(chats, wanted);
    if (picked === 'ambiguous') {
      throw new AppError(WhatsappErrors.CHAT_NOT_FOUND, {
        detail: `More than one chat is called "${wanted}": use the chat's id.`,
      });
    }
    if (picked) return targetOf(picked);
    const phoneChat = directChatOfPhone(wanted);
    if (phoneChat && options.allowNew) {
      return { chatId: phoneChat, chatKind: 'direct', chatName: null, isNew: true };
    }
    throw new AppError(WhatsappErrors.CHAT_NOT_FOUND, {
      detail: `No chat on ${account.label} matches "${wanted}".`,
    });
  }
}

function targetOf(chat: WhatsappChat): WhatsappChatTarget {
  return { chatId: chat.chatId, chatKind: chat.chatKind, chatName: chat.chatName, isNew: false };
}

/** `+34 600 111 222` → `34600111222@s.whatsapp.net`; anything that is not a phone number is null. */
export function directChatOfPhone(value: string): string | null {
  const digits = value.replace(/[\s().-]/g, '');
  const match = /^\+?(\d{7,15})$/.exec(digits);
  return match ? `${match[1]}@s.whatsapp.net` : null;
}
