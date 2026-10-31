import { SessionTurnOrmEntity } from './database/session-turn.orm-entity';
import {
  type SessionTurnFold,
  TURN_DRIVES,
  TURN_ORIGINS,
  TURN_STATES,
  type TurnDrive,
  type TurnOrigin,
  type TurnState,
} from './domain/session-turn.policy';
import type { WorkSessionEntity } from './domain/work-session.entity';

/**
 * A turn across the boundary: the `session_turn` row the fold writes back and
 * reads under the session's lock (`SessionTurnRepository`).
 */
export class SessionTurnMapper {
  static toPersistence(session: WorkSessionEntity, turn: SessionTurnFold): SessionTurnOrmEntity {
    const record = new SessionTurnOrmEntity();
    record.organizationId = session.organizationId;
    record.sessionId = session.id;
    record.seq = turn.seq;
    record.origin = turn.origin;
    record.drive = turn.drive;
    record.state = turn.state;
    record.prompt = turn.prompt;
    record.observedWorking = turn.observedWorking;
    record.startedAt = turn.startedAt;
    record.endedAt = turn.endedAt;
    record.exitCode = turn.exitCode;
    record.agentSessionId = turn.agentSessionId;
    record.result = turn.result;
    record.failureDetail = turn.failureDetail;
    record.costUsd = turn.costUsd === null ? null : turn.costUsd.toFixed(6);
    record.permissionDenials = turn.permissionDenials;
    record.outputRef = turn.outputRef;
    record.model = turn.model;
    record.inputTokens = turn.inputTokens === null ? null : String(turn.inputTokens);
    record.outputTokens = turn.outputTokens === null ? null : String(turn.outputTokens);
    record.cacheReadTokens = turn.cacheReadTokens === null ? null : String(turn.cacheReadTokens);
    record.cacheWriteTokens = turn.cacheWriteTokens === null ? null : String(turn.cacheWriteTokens);
    return record;
  }

  /** A stored turn as the fold reads it. Values outside the unions read as their safest member. */
  static toDomain(record: SessionTurnOrmEntity): SessionTurnFold {
    return {
      seq: record.seq,
      origin: (TURN_ORIGINS as readonly string[]).includes(record.origin)
        ? (record.origin as TurnOrigin)
        : 'person',
      drive: (TURN_DRIVES as readonly string[]).includes(record.drive)
        ? (record.drive as TurnDrive)
        : 'interactive',
      state: (TURN_STATES as readonly string[]).includes(record.state)
        ? (record.state as TurnState)
        : 'queued',
      prompt: record.prompt,
      observedWorking: record.observedWorking,
      startedAt: record.startedAt ? new Date(record.startedAt) : null,
      endedAt: record.endedAt ? new Date(record.endedAt) : null,
      exitCode: record.exitCode,
      agentSessionId: record.agentSessionId,
      result: record.result,
      failureDetail: record.failureDetail,
      costUsd: record.costUsd === null ? null : Number(record.costUsd),
      permissionDenials: record.permissionDenials,
      outputRef: record.outputRef,
      model: record.model,
      inputTokens: tokenCount(record.inputTokens),
      outputTokens: tokenCount(record.outputTokens),
      cacheReadTokens: tokenCount(record.cacheReadTokens),
      cacheWriteTokens: tokenCount(record.cacheWriteTokens),
    };
  }
}

/**
 * A `bigint` column as the fold reads it. `pg` returns bigint as a string so
 * that nothing past 2^53 is silently rounded; a token count never gets there,
 * and one that somehow did reads as unmeasured rather than as a wrong number.
 */
function tokenCount(value: string | null): number | null {
  if (value === null) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}
