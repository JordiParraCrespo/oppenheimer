import type { EntityManager } from 'typeorm';
import type { SessionTurnFold } from '../domain/session-turn.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type { WorkSessionMapper } from '../work-session.mapper';
import type { SessionTurnOrmEntity } from './session-turn.orm-entity';

/**
 * The `session_turn` table, for `WorkSessionRepository` alone. Turns are folded
 * from the log like the session row, so both of these run under the row lock
 * the append holds, on its transaction.
 */
export class SessionTurnRepository {
  constructor(private readonly mapper: WorkSessionMapper) {}

  /** The latest turn is folded like the row, so it is read under the same lock. */
  async findLatest(manager: EntityManager, sessionId: string): Promise<SessionTurnFold | null> {
    const [latestTurn]: SessionTurnOrmEntity[] = await manager.query(
      `SELECT * FROM "session_turn" WHERE "sessionId" = $1 ORDER BY "seq" DESC LIMIT 1`,
      [sessionId],
    );
    return latestTurn ? this.mapper.turnToDomain(latestTurn) : null;
  }

  /**
   * Write back the turns this append's folds moved: an upsert on
   * `(sessionId, seq)`, because a fold both opens turns and moves them.
   */
  async writeChanged(manager: EntityManager, session: WorkSessionEntity): Promise<void> {
    for (const turn of session.takeChangedTurns()) {
      const row = this.mapper.turnToPersistence(session, turn);
      await manager.query(
        `INSERT INTO "session_turn"
           ("organizationId", "sessionId", "seq", "origin", "drive", "state", "prompt",
            "observedWorking", "startedAt", "endedAt", "exitCode", "agentSessionId",
            "result", "failureDetail", "costUsd", "permissionDenials", "outputRef",
            "model", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
                 $18,$19,$20,$21,$22)
         ON CONFLICT ("sessionId", "seq") DO UPDATE SET
           "drive" = EXCLUDED."drive", "state" = EXCLUDED."state",
           "prompt" = EXCLUDED."prompt", "observedWorking" = EXCLUDED."observedWorking",
           "startedAt" = EXCLUDED."startedAt", "endedAt" = EXCLUDED."endedAt",
           "exitCode" = EXCLUDED."exitCode", "agentSessionId" = EXCLUDED."agentSessionId",
           "result" = EXCLUDED."result", "failureDetail" = EXCLUDED."failureDetail",
           "costUsd" = EXCLUDED."costUsd", "permissionDenials" = EXCLUDED."permissionDenials",
           "outputRef" = EXCLUDED."outputRef", "model" = EXCLUDED."model",
           "inputTokens" = EXCLUDED."inputTokens", "outputTokens" = EXCLUDED."outputTokens",
           "cacheReadTokens" = EXCLUDED."cacheReadTokens",
           "cacheWriteTokens" = EXCLUDED."cacheWriteTokens", "updatedAt" = now()`,
        [
          row.organizationId,
          row.sessionId,
          row.seq,
          row.origin,
          row.drive,
          row.state,
          row.prompt,
          row.observedWorking,
          row.startedAt,
          row.endedAt,
          row.exitCode,
          row.agentSessionId,
          row.result,
          row.failureDetail,
          row.costUsd,
          row.permissionDenials,
          row.outputRef,
          row.model,
          row.inputTokens,
          row.outputTokens,
          row.cacheReadTokens,
          row.cacheWriteTokens,
        ],
      );
    }
  }
}
