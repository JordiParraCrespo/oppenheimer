import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { BotAvatarColor, BotPermission, BotProvider } from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { BotOrmEntity } from './database/bot.orm-entity';
import { BotEntity } from './domain/bot.entity';
import { BotResponseDto } from './dtos/bot.response.dto';

/** The `CHECK`s on `bot` hold the unions, so a stored value is read as one. */
@Injectable()
export class BotMapper implements Mapper<BotEntity, BotOrmEntity, BotResponseDto> {
  toPersistence(entity: BotEntity): BotOrmEntity {
    const record = new BotOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.createdByUserId = entity.createdByUserId;
    record.name = entity.name;
    record.description = entity.description;
    record.avatarColor = entity.avatarColor;
    record.groupId = entity.groupId;
    record.position = entity.position;
    record.homeHostId = entity.homeHostId;
    record.provider = entity.provider;
    record.model = entity.model;
    record.effort = entity.effort;
    record.permission = entity.permission;
    record.learnAutomatically = entity.learnAutomatically;
    return record;
  }

  toDomain(record: BotOrmEntity): BotEntity {
    return BotEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        createdByUserId: record.createdByUserId ?? null,
        name: record.name,
        description: record.description,
        avatarColor: record.avatarColor as BotAvatarColor,
        groupId: record.groupId ?? null,
        position: record.position,
        homeHostId: record.homeHostId ?? null,
        provider: record.provider as BotProvider,
        model: record.model ?? null,
        effort: (record.effort ?? null) as SessionEffort | null,
        permission: record.permission as BotPermission,
        learnAutomatically: record.learnAutomatically,
        lastMessageAt: record.lastMessageAt ?? null,
        lastMessagePreview: record.lastMessagePreview ?? null,
      },
    });
  }

  toResponse(entity: BotEntity): BotResponseDto {
    const dto = new BotResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.avatarColor = entity.avatarColor;
    dto.groupId = entity.groupId;
    dto.position = entity.position;
    dto.homeHostId = entity.homeHostId;
    dto.provider = entity.provider;
    dto.model = entity.model;
    dto.effort = entity.effort;
    dto.permission = entity.permission;
    dto.learnAutomatically = entity.learnAutomatically;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    dto.lastActivityAt = (entity.lastMessageAt ?? entity.updatedAt).toISOString();
    dto.lastMessagePreview = entity.lastMessagePreview;
    return dto;
  }
}
