import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import {
  BOT_TURN_ORIGINS,
  type BotProvider,
  type BotTurnLane,
  type BotTurnStatus,
  type Scope,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { BotTurnOrmEntity, type BotTurnPlanLimitsRecord } from './database/bot-turn.orm-entity';
import {
  BotTurnEntity,
  type BotTurnPlanLimits,
  type BotTurnPlanWindow,
} from './domain/bot-turn.entity';
import { type BotTurnPlanLimitsDto, BotTurnResponseDto } from './dtos/bot-turn.response.dto';

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
    record.lane = entity.lane;
    record.chainId = entity.chainId;
    record.chainDepth = entity.chainDepth;
    record.askedByBotId = entity.askedByBotId;
    record.askedByTurnId = entity.askedByTurnId;
    record.replyRequested = entity.replyRequested;
    record.answersTurnId = entity.answersTurnId;
    record.error = entity.error;
    record.failure = entity.failure;
    record.inputTokens = entity.inputTokens;
    record.outputTokens = entity.outputTokens;
    record.contextTokens = entity.context?.tokens ?? null;
    record.contextWindow = entity.context?.window ?? null;
    record.planLimits = planLimitsToRecord(entity.planLimits);
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
        lane: (record.lane ?? 'owner') as BotTurnLane,
        chainId: record.chainId ?? null,
        chainDepth: record.chainDepth ?? 0,
        askedByBotId: record.askedByBotId ?? null,
        askedByTurnId: record.askedByTurnId ?? null,
        replyRequested: record.replyRequested === true,
        answersTurnId: record.answersTurnId ?? null,
        error: record.error ?? null,
        failure: record.failure ?? null,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        context:
          record.contextTokens === null || record.contextTokens === undefined
            ? null
            : { tokens: record.contextTokens, window: record.contextWindow ?? null },
        planLimits: planLimitsFromRecord(record.planLimits),
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
    dto.failure = entity.failure;
    dto.inputTokens = entity.inputTokens;
    dto.outputTokens = entity.outputTokens;
    dto.contextTokens = entity.context?.tokens ?? null;
    dto.contextWindow = entity.context?.window ?? null;
    dto.planLimits = planLimitsToRecord(entity.planLimits) as BotTurnPlanLimitsDto | null;
    dto.cancelRequested = entity.cancelRequestedAt !== null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.startedAt = entity.startedAt?.toISOString() ?? null;
    dto.endedAt = entity.endedAt?.toISOString() ?? null;
    return dto;
  }
}

/** The windows as `"planLimits"` stores them and the response says them: resets as ISO 8601. */
function planLimitsToRecord(limits: BotTurnPlanLimits | null): BotTurnPlanLimitsRecord | null {
  if (!limits) return null;
  const window = (w: BotTurnPlanWindow | null) =>
    w ? { usedPercent: w.usedPercent, resetsAt: w.resetsAt?.toISOString() ?? null } : null;
  return { fiveHour: window(limits.fiveHour), sevenDay: window(limits.sevenDay) };
}

/** `"planLimits"` read back, loosely: a window that does not read as one is left out. */
function planLimitsFromRecord(value: unknown): BotTurnPlanLimits | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const window = (raw: unknown): BotTurnPlanWindow | null => {
    if (typeof raw !== 'object' || raw === null) return null;
    const { usedPercent, resetsAt } = raw as Record<string, unknown>;
    if (typeof usedPercent !== 'number' || !Number.isFinite(usedPercent)) return null;
    const reset = typeof resetsAt === 'string' ? new Date(resetsAt) : null;
    return {
      usedPercent,
      resetsAt: reset && !Number.isNaN(reset.getTime()) ? reset : null,
    };
  };
  const limits = { fiveHour: window(record.fiveHour), sevenDay: window(record.sevenDay) };
  return limits.fiveHour || limits.sevenDay ? limits : null;
}
