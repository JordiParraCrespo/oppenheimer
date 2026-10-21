import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { BotImageMimeType } from '@oppenheimer/shared';
import { BotAttachmentOrmEntity } from './database/bot-attachment.orm-entity';
import { BotAttachmentEntity } from './domain/bot-attachment.entity';
import { BotAttachmentResponseDto } from './dtos/bot-attachment.response.dto';

@Injectable()
export class BotAttachmentMapper
  implements Mapper<BotAttachmentEntity, BotAttachmentOrmEntity, BotAttachmentResponseDto>
{
  toPersistence(entity: BotAttachmentEntity): BotAttachmentOrmEntity {
    const record = new BotAttachmentOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.uploadedByUserId = entity.uploadedByUserId;
    record.messageId = entity.messageId;
    record.storageKey = entity.storageKey;
    record.mimeType = entity.mimeType;
    record.sizeBytes = entity.sizeBytes;
    record.name = entity.name;
    return record;
  }

  toDomain(record: BotAttachmentOrmEntity): BotAttachmentEntity {
    return BotAttachmentEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        uploadedByUserId: record.uploadedByUserId,
        messageId: record.messageId,
        storageKey: record.storageKey,
        mimeType: record.mimeType as BotImageMimeType,
        sizeBytes: record.sizeBytes,
        name: record.name,
      },
    });
  }

  toResponse(entity: BotAttachmentEntity): BotAttachmentResponseDto {
    return Object.assign(new BotAttachmentResponseDto(), entity.toMessageAttachment());
  }
}
