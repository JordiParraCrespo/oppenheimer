import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * One turn of a session: a prompt given to the agent and what became of it.
 * A projection of `work_session_event`, written in the append's transaction
 * (`1790400000000-AddSessionTurns`, `domain/session-turn.policy.ts`).
 */
@Entity('session_turn')
@Unique('UQ_session_turn_session_seq', ['sessionId', 'seq'])
@Index('IDX_session_turn_organization_session', ['organizationId', 'sessionId'])
@Index('IDX_session_turn_live', ['sessionId'], {
  where: `"state" IN ('queued', 'in_progress', 'requires_action')`,
})
@Check('CHK_session_turn_seq', '"seq" >= 1')
export class SessionTurnOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'integer' })
  seq!: number;

  @Column({ type: 'varchar', length: 16 })
  origin!: string;

  @Column({ type: 'varchar', length: 16, default: 'interactive' })
  drive!: string;

  @Column({ type: 'varchar', length: 20, default: 'queued' })
  state!: string;

  @Column({ type: 'text', nullable: true })
  prompt!: string | null;

  @Column({ type: 'boolean', default: false })
  observedWorking!: boolean;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  startedAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'integer', nullable: true })
  exitCode!: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  agentSessionId!: string | null;

  @Column({ type: 'text', nullable: true })
  result!: string | null;

  @Column({ type: 'text', nullable: true })
  failureDetail!: string | null;

  /** numeric(12,6): the driver returns a string, which the mapper reads as a number. */
  @Column({ type: 'numeric', precision: 12, scale: 6, nullable: true })
  costUsd!: string | null;

  @Column({ type: 'integer', default: 0 })
  permissionDenials!: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  outputRef!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
