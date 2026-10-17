import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { BotAuthor } from '@oppenheimer/shared';
import { BotMemoryFactOrmEntity } from './database/bot-memory-fact.orm-entity';
import { BotMemoryFactEntity } from './domain/bot-memory-fact.entity';
import { BotMemoryFactResponseDto } from './dtos/bot-memory-fact.response.dto';

@Injectable()
export class BotMemoryFactMapper
  implements Mapper<BotMemoryFactEntity, BotMemoryFactOrmEntity, BotMemoryFactResponseDto>
{
  toPersistence(entity: BotMemoryFactEntity): BotMemoryFactOrmEntity {
    const record = new BotMemoryFactOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.content = entity.content;
    record.source = entity.source;
    return record;
  }

  toDomain(record: BotMemoryFactOrmEntity): BotMemoryFactEntity {
    return BotMemoryFactEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        content: record.content,
        source: record.source as BotAuthor,
      },
    });
  }

  toResponse(entity: BotMemoryFactEntity): BotMemoryFactResponseDto {
    const dto = new BotMemoryFactResponseDto();
    dto.id = entity.id;
    dto.content = entity.content;
    dto.source = entity.source;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
