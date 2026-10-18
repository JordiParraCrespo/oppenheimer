import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import {
  BOT_TURN_ORIGINS,
  type BotProvider,
  type BotTurnStatus,
  type Scope,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { BotTurnOrmEntity } from './database/bot-turn.orm-entity';
import { BotTurnEntity } from './domain/bot-turn.entity';
import { BotTurnResponseDto } from './dtos/bot-turn.response.dto';

@Injectable()
export class BotTurnMapper implements Mapper<BotTurnEntity, BotTurnOrmEntity, BotTurnResponseDto> {
  toPersistence(entity: BotTurnEntity): BotTurnOrmEntity {
    const record = new BotTurnOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.requestedByUserId = entity.requestedByUserId;
    record.status = entity.status;
    record.origin = entity.origin;
    record.sourceKey = entity.sourceKey;
    record.provider = entity.provider;
    record.model = entity.model;
    record.effort = entity.effort;
    record.timeZone = entity.timeZone;
    record.credentialScopes = entity.credentialScopes ? [...entity.credentialScopes] : null;
    record.error = entity.error;
    record.inputTokens = entity.inputTokens;
    record.outputTokens = entity.outputTokens;
    record.cancelRequestedAt = entity.cancelRequestedAt;
    record.startedAt = entity.startedAt;
    record.endedAt = entity.endedAt;
    return record;
  }

  toDomain(record: BotTurnOrmEntity): BotTurnEntity {
    return BotTurnEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        requestedByUserId: record.requestedByUserId ?? null,
        status: record.status as BotTurnStatus,
        origin: BOT_TURN_ORIGINS.find((origin) => origin === record.origin) ?? 'message',
        sourceKey: record.sourceKey ?? null,
        provider: record.provider as BotProvider,
        model: record.model,
        effort: (record.effort ?? null) as SessionEffort | null,
        timeZone: record.timeZone ?? null,
        credentialScopes: (record.credentialScopes ?? null) as Scope[] | null,
        error: record.error ?? null,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        cancelRequestedAt: record.cancelRequestedAt ?? null,
        startedAt: record.startedAt ?? null,
        endedAt: record.endedAt ?? null,
      },
    });
  }

  toResponse(entity: BotTurnEntity): BotTurnResponseDto {
    const dto = new BotTurnResponseDto();
    dto.id = entity.id;
    dto.status = entity.status;
    dto.provider = entity.provider;
    dto.model = entity.model;
    dto.error = entity.error;
    dto.inputTokens = entity.inputTokens;
    dto.outputTokens = entity.outputTokens;
    dto.cancelRequested = entity.cancelRequestedAt !== null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.startedAt = entity.startedAt?.toISOString() ?? null;
    dto.endedAt = entity.endedAt?.toISOString() ?? null;
    return dto;
  }
}
