import { Injectable } from '@nestjs/common';
import { SCOPES, type Scope } from '@oppenheimer/shared';
import { BotGoalOrmEntity } from './database/bot-goal.orm-entity';
import { BotGoalEntity } from './domain/bot-goal.entity';
import { BotGoalResponseDto } from './dtos/bot-goal.response.dto';

@Injectable()
export class BotGoalMapper {
  toPersistence(entity: BotGoalEntity): BotGoalOrmEntity {
    const record = new BotGoalOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.originTurnId = entity.originTurnId;
    record.objective = entity.objective;
    record.limit = entity.limit;
    record.continuations = entity.continuations;
    record.credentialScopes = entity.credentialScopes ? [...entity.credentialScopes] : null;
    record.timeZone = entity.timeZone;
    return record;
  }

  toDomain(record: BotGoalOrmEntity): BotGoalEntity {
    return BotGoalEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        originTurnId: record.originTurnId,
        objective: record.objective,
        limit: record.limit,
        continuations: record.continuations,
        credentialScopes: record.credentialScopes ? scopesOf(record.credentialScopes) : null,
        timeZone: record.timeZone,
      },
    });
  }

  toResponse(entity: BotGoalEntity): BotGoalResponseDto {
    const dto = new BotGoalResponseDto();
    dto.id = entity.id;
    dto.objective = entity.objective;
    dto.continuations = entity.continuations;
    dto.limit = entity.limit;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }

  /** What `set_goal` answers: the goal, what replaced it, and how continuations work. */
  toSetAnswer(goal: BotGoalEntity, replaced: BotGoalEntity | null): string {
    const before = replaced ? ` It replaces your goal "${replaced.objective}".` : '';
    return `Goal set: ${goal.objective}.${before} When a turn of yours ends with it still open, you get a continuation turn to keep going, at most ${goal.limit}. Call end_goal when it is met or cannot go on without the person.`;
  }
}

function scopesOf(stored: readonly string[]): Scope[] {
  return stored.filter((scope): scope is Scope => (SCOPES as readonly string[]).includes(scope));
}
