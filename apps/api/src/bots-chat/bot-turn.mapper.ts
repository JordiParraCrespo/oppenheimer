import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { ErrorReportContext, ErrorReportLevel } from '@oppenheimer/backend-error-reporting';
import {
  BOT_TURN_ORIGINS,
  type BotProvider,
  type BotTurnLane,
  type BotTurnStatus,
  botDefaultModel,
  SCOPES,
  type Scope,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { BotEntity } from '../bots/domain/bot.entity';
import { BotTurnOrmEntity, type BotTurnPlanLimitsRecord } from './database/bot-turn.orm-entity';
import {
  BOT_CONTACT_CHATS,
  BotTurnEntity,
  type BotTurnPlanLimits,
  type BotTurnPlanWindow,
} from './domain/bot-turn.entity';
import { BotActivityResponseDto } from './dtos/bot-activity.response.dto';
import { type BotTurnPlanLimitsDto, BotTurnResponseDto } from './dtos/bot-turn.response.dto';
import type { CheckBack } from './infrastructure/bot-check-backs.port';

@Injectable()
export class BotTurnMapper implements Mapper<BotTurnEntity, BotTurnOrmEntity, BotTurnResponseDto> {
  /**
   * What a failed turn is reported with: who and which model, never what was
   * said. Grouped by provider and failure, so one provider's bad hour is one
   * issue rather than one per turn.
   */
  static toErrorReport(turn: BotTurnEntity, level: ErrorReportLevel): ErrorReportContext {
    return {
      level,
      tags: {
        'bot.id': turn.botId,
        'bot.turn_id': turn.id,
        'bot.provider': turn.provider,
        'bot.model': turn.model,
        'bot.origin': turn.origin,
        'bot.failure': turn.failure,
      },
      fingerprint: ['bot-turn-failed', turn.provider, turn.failure ?? 'thrown', String(level)],
      userId: turn.requestedByUserId,
      workspaceId: turn.organizationId,
    };
  }

  toPersistence(entity: BotTurnEntity): BotTurnOrmEntity {
    const record = new BotTurnOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.conversationId = entity.conversationId;
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
    record.steer = entity.steer;
    record.contact = entity.contact;
    record.answersTurnId = entity.answersTurnId;
    record.error = entity.error;
    record.failure = entity.failure;
    record.inputTokens = entity.inputTokens;
    record.outputTokens = entity.outputTokens;
    record.cacheReadTokens = entity.cacheReadTokens;
    record.cacheWriteTokens = entity.cacheWriteTokens;
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
        conversationId: record.conversationId,
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
        steer: record.steer === true,
        contact: BOT_CONTACT_CHATS.find((kind) => kind === record.contact) ?? null,
        answersTurnId: record.answersTurnId ?? null,
        error: record.error ?? null,
        failure: record.failure ?? null,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        cacheReadTokens: record.cacheReadTokens,
        cacheWriteTokens: record.cacheWriteTokens,
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

  /** Which bots are working and which wait on you, as `GET /bot-activity` answers it. */
  toActivityResponse(activity: {
    working: readonly string[];
    waitingOnYou: readonly string[];
  }): BotActivityResponseDto {
    const dto = new BotActivityResponseDto();
    dto.working = [...activity.working];
    dto.waitingOnYou = [...activity.waitingOnYou];
    return dto;
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
    dto.steer = entity.steer;
    dto.createdAt = entity.createdAt.toISOString();
    dto.startedAt = entity.startedAt?.toISOString() ?? null;
    dto.endedAt = entity.endedAt?.toISOString() ?? null;
    return dto;
  }

  /**
   * What a look's turn is queued with (`checkBackTurn`): the bot's model, as
   * its owner, with the scopes and zone of the turn that set the look.
   */
  toCheckBackTurnProps(
    look: Pick<CheckBack, 'organizationId' | 'credentialScopes' | 'timeZone'>,
    bot: Pick<BotEntity, 'id' | 'provider' | 'model' | 'effort'>,
    ownerUserId: string,
  ): Omit<Parameters<typeof BotTurnEntity.queue>[0], 'origin' | 'sourceKey' | 'lane'> {
    return {
      organizationId: look.organizationId,
      botId: bot.id,
      requestedByUserId: ownerUserId,
      provider: bot.provider,
      model: bot.model ?? botDefaultModel(bot.provider).id,
      effort: bot.effort,
      timeZone: look.timeZone,
      credentialScopes: look.credentialScopes,
    };
  }

  /** A look as its job's payload carries it: the look, dates as ISO 8601. */
  toCheckBackPayload(look: CheckBack): Record<string, unknown> {
    return {
      botId: look.botId,
      organizationId: look.organizationId,
      originTurnId: look.originTurnId,
      chainId: look.chainId,
      step: look.step,
      chainStartedAt: look.chainStartedAt.toISOString(),
      about: look.about,
      at: look.at.toISOString(),
      credentialScopes: look.credentialScopes ? [...look.credentialScopes] : null,
      timeZone: look.timeZone,
    };
  }

  /** A job's payload read back as the look it was staged from; null for one that does not read as one. */
  toCheckBack(input: unknown): CheckBack | null {
    const data =
      typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
    const text = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : null);
    const date = (key: string) => {
      const parsed = new Date(text(key) ?? Number.NaN);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const [botId, organizationId, originTurnId, chainId, about] = [
      'botId',
      'organizationId',
      'originTurnId',
      'chainId',
      'about',
    ].map(text);
    const chainStartedAt = date('chainStartedAt');
    const at = date('at');
    const step = data.step;
    if (!botId || !organizationId || !originTurnId || !chainId || !about) return null;
    if (!chainStartedAt || !at || typeof step !== 'number' || !Number.isInteger(step)) return null;
    return {
      botId,
      organizationId,
      originTurnId,
      chainId,
      step,
      chainStartedAt,
      about,
      at,
      credentialScopes: Array.isArray(data.credentialScopes)
        ? data.credentialScopes.filter((scope): scope is Scope =>
            (SCOPES as readonly unknown[]).includes(scope),
          )
        : null,
      timeZone: text('timeZone') ?? 'UTC',
    };
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
