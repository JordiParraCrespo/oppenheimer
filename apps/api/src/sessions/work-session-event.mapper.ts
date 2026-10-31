import type { NewSessionEvent } from './database/work-session.repository.port';
import { WorkSessionEventOrmEntity } from './database/work-session-event.orm-entity';
import { WorkSessionEventEntity } from './domain/work-session-event.entity';
import { SessionEventResponseDto } from './dtos/session-event.response.dto';

/**
 * One row the batched append's `INSERT … RETURNING` answers, beside the count of
 * rows it meant to insert. `id` is null on the single row that comes back when
 * nothing landed at all.
 */
export interface AppendedEventRow {
  expected: number;
  id: string | null;
  seq: number;
  idempotencyKey: string;
  source: WorkSessionEventOrmEntity['source'];
  kind: string;
  payload: unknown;
  occurredAt: Date;
  recordedAt: Date;
}

/**
 * A log entry across the boundary: the batch the append's one statement reads,
 * the rows it answers, the stored `work_session_event` row and its response
 * (`WorkSessionEventRepository`).
 */
export class WorkSessionEventMapper {
  static toPersistence(entity: WorkSessionEventEntity): WorkSessionEventOrmEntity {
    const record = new WorkSessionEventOrmEntity();
    record.id = entity.id;
    record.sessionId = entity.sessionId;
    record.seq = entity.seq;
    record.idempotencyKey = entity.idempotencyKey;
    record.source = entity.source;
    record.kind = entity.kind;
    record.payload = entity.payload;
    record.occurredAt = entity.occurredAt;
    record.recordedAt = entity.recordedAt;
    return record;
  }

  static toDomain(record: WorkSessionEventOrmEntity): WorkSessionEventEntity {
    return WorkSessionEventEntity.create({
      id: record.id,
      createdAt: record.recordedAt,
      updatedAt: record.recordedAt,
      props: {
        sessionId: record.sessionId,
        seq: record.seq,
        idempotencyKey: record.idempotencyKey,
        source: record.source,
        kind: record.kind,
        payload: record.payload,
        occurredAt: record.occurredAt,
        recordedAt: record.recordedAt,
      },
    });
  }

  /**
   * A batch as the append's single `INSERT` reads it: a JSON array for
   * `jsonb_to_recordset`, each entry numbered so the statement can keep the
   * caller's order when it hands out `seq`. An absent payload is `{}`, an absent
   * `occurredAt` is now.
   */
  static toAppendRecordset(events: readonly NewSessionEvent[]): string {
    const now = new Date();
    return JSON.stringify(
      events.map((event, ord) => ({
        ord,
        idempotencyKey: event.idempotencyKey,
        source: event.source,
        kind: event.kind,
        payload: event.payload ?? {},
        occurredAt: (event.occurredAt ?? now).toISOString(),
      })),
    );
  }

  /** A row the batched append landed, as the log entry the fold reads. */
  static appendedToDomain(sessionId: string, row: AppendedEventRow): WorkSessionEventEntity {
    return WorkSessionEventEntity.create({
      id: row.id ?? '',
      createdAt: row.recordedAt,
      updatedAt: row.recordedAt,
      props: {
        sessionId,
        seq: row.seq,
        idempotencyKey: row.idempotencyKey,
        source: row.source,
        kind: row.kind,
        payload: row.payload,
        occurredAt: row.occurredAt,
        recordedAt: row.recordedAt,
      },
    });
  }

  static toResponse(entity: WorkSessionEventEntity): SessionEventResponseDto {
    const dto = new SessionEventResponseDto();
    dto.id = entity.id;
    dto.sessionId = entity.sessionId;
    dto.seq = entity.seq;
    dto.source = entity.source;
    dto.kind = entity.kind;
    dto.payload = entity.payload;
    dto.occurredAt = entity.occurredAt;
    dto.recordedAt = entity.recordedAt;
    return dto;
  }
}
