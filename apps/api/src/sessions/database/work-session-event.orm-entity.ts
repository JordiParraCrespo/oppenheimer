import { TimestampColumn } from '@oppenheimer/backend-ddd';
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { SessionEventSource } from '../domain/work-session-event.entity';

/**
 * A session's append-only log, which is the truth per session.
 *
 * The two uniques are the whole design. `(sessionId, seq)` is what makes the log
 * dense and monotonic, and `seq` is assigned by the control plane under a row lock
 * on `work_session` rather than by the writer, so a buggy or hostile host cannot
 * create gaps or regress it. `(sessionId, idempotencyKey)` is what makes an append
 * idempotent: one
 * `INSERT … ON CONFLICT ("sessionId", "idempotencyKey") DO NOTHING` per row means a
 * batch replayed after a dropped acknowledgement, or half-applied before a crash,
 * appends only what was not yet seen.
 *
 * There is no `organizationId` here, and that is deliberate: every read is by
 * session, through a session the caller has already been scoped to. It is the one
 * of the new tables that is not workspace-owned, because it has no life of its own.
 * No other index either, for the same reason.
 */
@Entity('work_session_event')
@Index('IDX_work_session_event_session_seq', ['sessionId', 'seq'], { unique: true })
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
   * Capped at 8 KB and never pane text: PTY bytes go to the browser and the
   * runner's ring buffer, never to Postgres. The wire carries it as a JSON string
   * so the cap survives into the generated Go; it is parsed at the boundary and
   * stored as jsonb.
   */
  @Column({ type: 'jsonb' })
  payload!: unknown;

  /** The writer's clock. */
  @TimestampColumn()
  occurredAt!: Date;

  /** Ours. A host with a skewed clock cannot reorder anybody's history. */
  @TimestampColumn({ default: () => 'now()' })
  recordedAt!: Date;
}
