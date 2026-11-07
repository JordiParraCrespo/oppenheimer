import { Injectable } from '@nestjs/common';
import { BotNoticeOrmEntity } from './database/bot-notice.orm-entity';
import { BotNoticeEntity } from './domain/bot-notice.entity';
import { WorkspaceBotNoticeResponseDto } from './dtos/workspace-bot-notice.response.dto';

@Injectable()
export class BotNoticeMapper {
  toPersistence(entity: BotNoticeEntity): BotNoticeOrmEntity {
    const record = new BotNoticeOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.text = entity.text;
    return record;
  }

  toDomain(record: BotNoticeOrmEntity): BotNoticeEntity {
    return BotNoticeEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        text: record.text,
      },
    });
  }

  /** A notice as the Inbox reads it: the line, whose bot by name, and when it came. */
  toWorkspaceResponse(entity: BotNoticeEntity, botName: string): WorkspaceBotNoticeResponseDto {
    const dto = new WorkspaceBotNoticeResponseDto();
    dto.id = entity.id;
    dto.botId = entity.botId;
    dto.botName = botName;
    dto.text = entity.text;
    dto.at = entity.updatedAt.toISOString();
    return dto;
  }
}
