import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { SessionEventSource } from '../domain/work-session-event.entity';

/**
 * A session's append-only log, which is the truth per session.
 *
 * `(sessionId, seq)` keeps the log dense and monotonic; `seq` is assigned by the
 * control plane under a row lock on `work_session`, not by the writer.
 * `(sessionId, idempotencyKey)` makes an append idempotent: a batch replayed after
 * a dropped acknowledgement, or half-applied before a crash, appends only what was
 * not yet seen.
 *
 * No `organizationId`, deliberately: every read goes through a session the caller is
 * already scoped to, and the log has no life of its own. The partial index covers the
 * at most one `prompt.first` row per session, which a runner's hello reads for every
 * unresolved session on its host.
 */
@Entity('work_session_event')
@Index('IDX_work_session_event_session_seq', ['sessionId', 'seq'], { unique: true })
@Index('IDX_work_session_event_first_prompt', ['sessionId'], { where: `"kind" = 'prompt.first'` })
@Unique('UQ_work_session_event_session_key', ['sessionId', 'idempotencyKey'])
export class WorkSessionEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  /** Dense and monotonic per session. Assigned here, never on the wire. */
  @Column({ type: 'integer' })
  seq!: number;

  /** `<runId>:<n>` from a runner, `<kind>:<commandId>` from the API. */
  @Column({ type: 'varchar' })
  idempotencyKey!: string;

  @Column({ type: 'varchar' })
  source!: SessionEventSource;

  /**
   * Free-form on purpose: a runner newer than this control plane may log a kind it
   * has never heard of, and the log has to keep it. The fold acts on the kinds it
   * knows and advances `lastEventAt` for the rest.
   */
  @Column({ type: 'varchar' })
  kind!: string;

  /**
   * Capped at `SESSION_EVENT_PAYLOAD_MAX_BYTES` and never pane text; parsed at the
   * boundary and stored as jsonb.
   */
  @Column({ type: 'jsonb' })
  payload!: unknown;

  /** The writer's clock. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  occurredAt!: Date;

  /** Ours. A host with a skewed clock cannot reorder anybody's history. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, default: () => 'now()' })
  recordedAt!: Date;
}
