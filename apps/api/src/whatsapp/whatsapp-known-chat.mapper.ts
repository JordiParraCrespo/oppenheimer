import { Injectable } from '@nestjs/common';
import type { WhatsappGrantsOf } from './database/whatsapp-chat-grant.repository.port';
import type { WhatsappKnownChatOrmEntity } from './database/whatsapp-known-chat.orm-entity';
import type { WhatsappKnownChat } from './domain/whatsapp-message.types';

/** A reported chat as the number keeps it, and back. */
@Injectable()
export class WhatsappKnownChatMapper {
  toDomain(record: WhatsappKnownChatOrmEntity): WhatsappKnownChat {
    return { chatId: record.chatId, chatKind: record.chatKind, chatName: record.chatName };
  }

  /** The row a report writes for `chat`, stamped as reported now. */
  toPersistence(
    of: WhatsappGrantsOf,
    chat: WhatsappKnownChat,
  ): Pick<
    WhatsappKnownChatOrmEntity,
    'organizationId' | 'accountId' | 'chatId' | 'chatKind' | 'chatName'
  > & { updatedAt: () => string } {
    return {
      organizationId: of.organizationId,
      accountId: of.accountId,
      chatId: chat.chatId,
      chatKind: chat.chatKind,
      chatName: chat.chatName,
      updatedAt: () => 'now()',
    };
  }
}
