import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { BOT_AUTHORS } from '@oppenheimer/shared';
import { BotSkillOrmEntity } from './database/bot-skill.orm-entity';
import { BotSkillEntity } from './domain/bot-skill.entity';
import { BotSkillResponseDto } from './dtos/bot-skill.response.dto';

@Injectable()
export class BotSkillMapper
  implements Mapper<BotSkillEntity, BotSkillOrmEntity, BotSkillResponseDto>
{
  toPersistence(entity: BotSkillEntity): BotSkillOrmEntity {
    const record = new BotSkillOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.name = entity.name;
    record.description = entity.description;
    record.body = entity.body;
    record.userInvocable = entity.userInvocable;
    record.modelInvocable = entity.modelInvocable;
    record.source = entity.source;
    return record;
  }

  toDomain(record: BotSkillOrmEntity): BotSkillEntity {
    return BotSkillEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        name: record.name,
        description: record.description,
        body: record.body,
        userInvocable: record.userInvocable,
        modelInvocable: record.modelInvocable,
        source: BOT_AUTHORS.find((known) => known === record.source) ?? 'user',
      },
    });
  }

  toResponse(entity: BotSkillEntity): BotSkillResponseDto {
    const dto = new BotSkillResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.body = entity.body;
    dto.userInvocable = entity.userInvocable;
    dto.modelInvocable = entity.modelInvocable;
    dto.source = entity.source;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
