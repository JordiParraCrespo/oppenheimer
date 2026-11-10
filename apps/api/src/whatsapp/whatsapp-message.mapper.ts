import { Injectable } from '@nestjs/common';
import type { WhatsappInbound } from '@oppenheimer/shared/protocol';
import { WhatsappMessageOrmEntity } from './database/whatsapp-message.orm-entity';
import type { WhatsappAccountEntity } from './domain/whatsapp-account.entity';
import type {
  WhatsappChatPlace,
  WhatsappMessage,
  WhatsappMessageDraft,
  WhatsappStoredMessage,
} from './domain/whatsapp-message.types';

/** A number's messages between the wire, the table and the bots' reads. */
@Injectable()
export class WhatsappMessageMapper {
  /** One message off `whatsapp.messages`, for the account on the host that sent it. */
  fromInbound(account: WhatsappAccountEntity, inbound: WhatsappInbound): WhatsappMessageDraft {
    return {
      accountId: account.id,
      organizationId: account.organizationId,
      externalId: inbound.id,
      chatId: inbound.chatId,
      chatKind: inbound.chatKind,
      chatName: inbound.chatName ?? null,
      senderId: inbound.senderId,
      senderName: inbound.senderName ?? null,
      fromMe: inbound.fromMe,
      text: inbound.text,
      media: inbound.media ?? null,
      quotedId: inbound.quotedId ?? null,
      sentAt: new Date(inbound.sentAt),
      sentByBotId: null,
      switchesToBotId: null,
      isReply: false,
    };
  }

  /**
   * What went out from the number, as the host answered it, kept beside what
   * it received: a bot's send (`botId`), a bot's answer to the owner
   * (`botId` and `isReply`), or a fixed line Oppenheimer sent itself (no
   * bot), each with the message it quotes, if any.
   */
  fromBotSend(props: {
    account: WhatsappAccountEntity;
    chat: { chatId: string; chatKind: 'direct' | 'group'; chatName: string | null };
    text: string;
    sent: { id: string; sentAt: Date };
    botId: string | null;
    isReply?: boolean;
    quotedId?: string | null;
  }): WhatsappMessageDraft {
    const { account, chat, sent } = props;
    return {
      accountId: account.id,
      organizationId: account.organizationId,
      externalId: sent.id,
      chatId: chat.chatId,
      chatKind: chat.chatKind,
      chatName: chat.chatName,
      senderId: account.phone ?? 'me',
      senderName: account.displayName,
      fromMe: true,
      text: props.text,
      media: null,
      quotedId: props.quotedId ?? null,
      sentAt: sent.sentAt,
      sentByBotId: props.botId,
      switchesToBotId: null,
      isReply: (props.isReply ?? false) && props.botId !== null,
    };
  }

  toPersistence(
    draft: WhatsappMessageDraft,
  ): Omit<WhatsappMessageOrmEntity, 'id' | 'createdAt' | 'seq'> {
    return { ...draft };
  }

  /** A row intake just stored, from the draft it wrote and what the insert returned. */
  toStored(
    draft: WhatsappMessageDraft,
    row: { id: string; seq: string },
    place: WhatsappChatPlace | null,
  ): WhatsappStoredMessage {
    return { ...draft, id: row.id, seq: String(row.seq), place };
  }

  toDomain(record: WhatsappMessageOrmEntity): WhatsappMessage {
    return {
      id: record.id,
      accountId: record.accountId,
      organizationId: record.organizationId,
      externalId: record.externalId,
      chatId: record.chatId,
      chatKind: record.chatKind,
      chatName: record.chatName,
      senderId: record.senderId,
      senderName: record.senderName,
      fromMe: record.fromMe,
      text: record.text,
      media: record.media,
      quotedId: record.quotedId,
      sentAt: record.sentAt,
      sentByBotId: record.sentByBotId,
    };
  }
}
