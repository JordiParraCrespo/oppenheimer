import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { BotPermissionRuleEffect } from '@oppenheimer/shared';
import { BotPermissionRuleOrmEntity } from './database/bot-permission-rule.orm-entity';
import { BotPermissionRuleEntity } from './domain/bot-permission-rule.entity';
import { BotPermissionRuleDto } from './dtos/bot-permissions.response.dto';

@Injectable()
export class BotPermissionRuleMapper
  implements Mapper<BotPermissionRuleEntity, BotPermissionRuleOrmEntity, BotPermissionRuleDto>
{
  toPersistence(entity: BotPermissionRuleEntity): BotPermissionRuleOrmEntity {
    const record = new BotPermissionRuleOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.effect = entity.effect;
    record.text = entity.text;
    record.createdByUserId = entity.createdByUserId;
    return record;
  }

  toDomain(record: BotPermissionRuleOrmEntity): BotPermissionRuleEntity {
    return BotPermissionRuleEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        effect: record.effect as BotPermissionRuleEffect,
        text: record.text,
        createdByUserId: record.createdByUserId,
      },
    });
  }

  toResponse(entity: BotPermissionRuleEntity): BotPermissionRuleDto {
    const dto = new BotPermissionRuleDto();
    dto.id = entity.id;
    dto.effect = entity.effect;
    dto.text = entity.text;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}
