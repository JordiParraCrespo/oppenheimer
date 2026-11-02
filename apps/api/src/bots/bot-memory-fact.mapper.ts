import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { BOT_MEMORY_SCOPES, BOT_MEMORY_TIERS, type BotAuthor } from '@oppenheimer/shared';
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
    record.tier = entity.tier;
    record.scope = entity.scope;
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
        tier: BOT_MEMORY_TIERS.find((known) => known === record.tier) ?? 'profile',
        scope: BOT_MEMORY_SCOPES.find((known) => known === record.scope) ?? 'bot',
      },
    });
  }

  toResponse(entity: BotMemoryFactEntity): BotMemoryFactResponseDto {
    const dto = new BotMemoryFactResponseDto();
    dto.id = entity.id;
    dto.content = entity.content;
    dto.source = entity.source;
    dto.tier = entity.tier;
    dto.scope = entity.scope;
    dto.botId = entity.botId;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
