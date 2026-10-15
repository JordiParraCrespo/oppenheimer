import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { BotGroupOrmEntity } from './database/bot-group.orm-entity';
import { BotGroupEntity } from './domain/bot-group.entity';
import { BotGroupResponseDto } from './dtos/bot-group.response.dto';

@Injectable()
export class BotGroupMapper
  implements Mapper<BotGroupEntity, BotGroupOrmEntity, BotGroupResponseDto>
{
  toPersistence(entity: BotGroupEntity): BotGroupOrmEntity {
    const record = new BotGroupOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.name = entity.name;
    record.position = entity.position;
    return record;
  }

  toDomain(record: BotGroupOrmEntity): BotGroupEntity {
    return BotGroupEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        name: record.name,
        position: record.position,
      },
    });
  }

  toResponse(entity: BotGroupEntity): BotGroupResponseDto {
    const dto = new BotGroupResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.position = entity.position;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
