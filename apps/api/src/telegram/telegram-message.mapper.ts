import { Injectable } from '@nestjs/common';
import type { TelegramInbound } from '@oppenheimer/shared/protocol';
import { TelegramMessageOrmEntity } from './database/telegram-message.orm-entity';
import type { TelegramAccountEntity } from './domain/telegram-account.entity';
import type { TelegramMessage, TelegramMessageDraft } from './domain/telegram-message.types';

/** A Telegram bot's messages between the wire, the table and the bots' reads. */
@Injectable()
export class TelegramMessageMapper {
  /** One message off `telegram.messages`, for the account on the host that sent it. */
  fromInbound(account: TelegramAccountEntity, inbound: TelegramInbound): TelegramMessageDraft {
    return {
      accountId: account.id,
      organizationId: account.organizationId,
      externalId: inbound.id,
      chatId: inbound.chatId,
      chatKind: inbound.chatKind,
      chatName: inbound.chatName ?? null,
      senderId: inbound.senderId,
      senderName: inbound.senderName ?? null,
      senderUsername: inbound.senderUsername ?? null,
      fromBot: account.botId !== null && inbound.senderId === account.botId,
      text: inbound.text,
      media: inbound.media ?? null,
      replyToId: inbound.replyToId ?? null,
      sentAt: new Date(inbound.sentAt),
      sentByBotId: null,
    };
  }

  /** What a bot sent, as the host answered it, kept beside what the Telegram bot received. */
  fromBotSend(props: {
    account: TelegramAccountEntity;
    chat: { chatId: string; chatKind: 'direct' | 'group'; chatName: string | null };
    text: string;
    replyToId: string | null;
    sent: { id: string; sentAt: Date };
    botId: string;
  }): TelegramMessageDraft {
    const { account, chat, sent } = props;
    return {
      accountId: account.id,
      organizationId: account.organizationId,
      externalId: sent.id,
      chatId: chat.chatId,
      chatKind: chat.chatKind,
      chatName: chat.chatName,
      senderId: account.botId ?? '0',
      senderName: account.displayName,
      senderUsername: account.username,
      fromBot: true,
      text: props.text,
      media: null,
      replyToId: props.replyToId,
      sentAt: sent.sentAt,
      sentByBotId: props.botId,
    };
  }

  toPersistence(draft: TelegramMessageDraft): Omit<TelegramMessageOrmEntity, 'id' | 'createdAt'> {
    return { ...draft };
  }

  toDomain(record: TelegramMessageOrmEntity): TelegramMessage {
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
      senderUsername: record.senderUsername,
      fromBot: record.fromBot,
      text: record.text,
      media: record.media,
      replyToId: record.replyToId,
      sentAt: record.sentAt,
      sentByBotId: record.sentByBotId,
    };
  }
}
