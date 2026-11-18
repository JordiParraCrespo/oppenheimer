import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { WhatsappChatGrantOrmEntity } from './database/whatsapp-chat-grant.orm-entity';
import { WhatsappChatGrantEntity } from './domain/whatsapp-chat-grant.entity';
import { WhatsappChatGrantResponseDto } from './dtos/whatsapp-chat-grant.response.dto';

@Injectable()
export class WhatsappChatGrantMapper
  implements
    Mapper<WhatsappChatGrantEntity, WhatsappChatGrantOrmEntity, WhatsappChatGrantResponseDto>
{
  toPersistence(entity: WhatsappChatGrantEntity): WhatsappChatGrantOrmEntity {
    const record = new WhatsappChatGrantOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.accountId = entity.accountId;
    record.chatId = entity.chatId;
    record.chatKind = entity.chatKind;
    record.chatName = entity.chatName;
    record.botId = entity.botId;
    record.grantedByBotId = entity.grantedByBotId;
    return record;
  }

  toDomain(record: WhatsappChatGrantOrmEntity): WhatsappChatGrantEntity {
    return WhatsappChatGrantEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        accountId: record.accountId,
        chatId: record.chatId,
        chatKind: record.chatKind,
        chatName: record.chatName,
        botId: record.botId,
        grantedByBotId: record.grantedByBotId,
      },
    });
  }

  toResponse(entity: WhatsappChatGrantEntity): WhatsappChatGrantResponseDto {
    const response = new WhatsappChatGrantResponseDto();
    response.id = entity.id;
    response.accountId = entity.accountId;
    response.chatId = entity.chatId;
    response.chatKind = entity.chatKind;
    response.chatName = entity.chatName;
    response.botId = entity.botId;
    response.grantedByBotId = entity.grantedByBotId;
    response.grantedAt = entity.createdAt.toISOString();
    return response;
  }
}
