import { Injectable } from '@nestjs/common';
import { SCOPES, type Scope } from '@oppenheimer/shared';
import { BotLoopOrmEntity } from './database/bot-loop.orm-entity';
import { BotLoopEntity } from './domain/bot-loop.entity';
import { BotLoopResponseDto } from './dtos/bot-loop.response.dto';

@Injectable()
export class BotLoopMapper {
  toPersistence(entity: BotLoopEntity): BotLoopOrmEntity {
    const record = new BotLoopOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.originTurnId = entity.originTurnId;
    record.prompt = entity.prompt;
    record.intervalMinutes = entity.intervalMinutes;
    record.runs = entity.runs;
    record.nextRunAt = entity.nextRunAt;
    record.expiresAt = entity.expiresAt;
    record.credentialScopes = entity.credentialScopes ? [...entity.credentialScopes] : null;
    record.timeZone = entity.timeZone;
    return record;
  }

  toDomain(record: BotLoopOrmEntity): BotLoopEntity {
    return BotLoopEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        originTurnId: record.originTurnId,
        prompt: record.prompt,
        intervalMinutes: record.intervalMinutes,
        runs: record.runs,
        nextRunAt: record.nextRunAt,
        expiresAt: record.expiresAt,
        credentialScopes: record.credentialScopes ? scopesOf(record.credentialScopes) : null,
        timeZone: record.timeZone,
      },
    });
  }

  toResponse(entity: BotLoopEntity): BotLoopResponseDto {
    const dto = new BotLoopResponseDto();
    dto.id = entity.id;
    dto.prompt = entity.prompt;
    dto.intervalMinutes = entity.intervalMinutes;
    dto.runs = entity.runs + 1;
    dto.nextRunAt = entity.nextRunAt?.toISOString() ?? null;
    dto.expiresAt = entity.expiresAt.toISOString();
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

function scopesOf(stored: readonly string[]): Scope[] {
  return stored.filter((scope): scope is Scope => (SCOPES as readonly string[]).includes(scope));
}
