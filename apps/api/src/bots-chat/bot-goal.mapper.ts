import { Injectable } from '@nestjs/common';
import { BOT_GOAL_PAUSE_REASONS, SCOPES, type Scope } from '@oppenheimer/shared';
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
    record.tokensUsed = String(entity.tokensUsed);
    record.tokenBudget = entity.tokenBudget === null ? null : String(entity.tokenBudget);
    record.idleTurns = entity.idleTurns;
    record.claim = entity.claim;
    record.pausedAt = entity.paused?.at ?? null;
    record.pauseReason = entity.paused?.reason ?? null;
    record.pauseNote = entity.paused?.note ?? null;
    record.credentialScopes = entity.credentialScopes ? [...entity.credentialScopes] : null;
    record.timeZone = entity.timeZone;
    record.waitingFor = entity.waiting?.system ?? null;
    record.waitingUntil = entity.waiting?.resetAt ?? null;
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
        tokensUsed: Number(record.tokensUsed),
        tokenBudget: record.tokenBudget === null ? null : Number(record.tokenBudget),
        idleTurns: record.idleTurns,
        claim: record.claim,
        paused: pausedOf(record),
        credentialScopes: record.credentialScopes ? scopesOf(record.credentialScopes) : null,
        timeZone: record.timeZone,
        waiting:
          record.waitingFor && record.waitingUntil
            ? { system: record.waitingFor, resetAt: record.waitingUntil }
            : null,
      },
    });
  }

  toResponse(entity: BotGoalEntity): BotGoalResponseDto {
    const dto = new BotGoalResponseDto();
    dto.id = entity.id;
    dto.objective = entity.objective;
    dto.continuations = entity.continuations;
    dto.limit = entity.limit;
    dto.tokensUsed = entity.tokensUsed;
    dto.tokenBudget = entity.tokenBudget;
    dto.paused = entity.paused
      ? {
          reason: entity.paused.reason,
          note: entity.paused.note,
          at: entity.paused.at.toISOString(),
        }
      : null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.waiting = entity.waiting
      ? { system: entity.waiting.system, until: entity.waiting.resetAt.toISOString() }
      : null;
    return dto;
  }

  /** What `set_goal` answers: the goal, what replaced it, and how continuations work. */
  toSetAnswer(goal: BotGoalEntity, replaced: BotGoalEntity | null): string {
    const before = replaced ? ` It replaces your goal "${replaced.objective}".` : '';
    const budget =
      goal.tokenBudget === null
        ? ''
        : ` It pauses once its turns spend ${goal.tokenBudget} tokens.`;
    return `Goal set: ${goal.objective}.${before} After each of your turns another comes, for as long as the goal is open.${budget} When it is met, show its check and call end_goal with outcome met: a reviewer reads your turn and ends it, or sends you on. If it cannot go on without the person, call end_goal with outcome blocked.`;
  }
}

/** The stored pause, or null while the goal runs (or when its reason is one this build does not know). */
function pausedOf(record: BotGoalOrmEntity): BotGoalEntity['paused'] {
  const reason = BOT_GOAL_PAUSE_REASONS.find((known) => known === record.pauseReason);
  if (!record.pausedAt || !reason) return null;
  return { reason, note: record.pauseNote, at: record.pausedAt };
}

function scopesOf(stored: readonly string[]): Scope[] {
  return stored.filter((scope): scope is Scope => (SCOPES as readonly string[]).includes(scope));
}
