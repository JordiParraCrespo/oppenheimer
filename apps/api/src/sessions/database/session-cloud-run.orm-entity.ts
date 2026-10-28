import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { CloudAgentProviderId, CloudAgentStatus } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * The vendor's half of a cloud session, one row per session and keyed by it
 * (`1791004100000-AddCloudSessions`): the vendor's agent, its page, the
 * repository it runs on, and what the vendor last said about its latest run.
 * The session's state is the fold of its log; this is what the next read asks
 * the vendor about, and what the session's row shows beside it.
 */
@Entity('session_cloud_run')
@Unique('UQ_session_cloud_run_external', ['provider', 'externalId'])
@Check('CHK_session_cloud_run_provider', `provider IN ('cursor')`)
@Check(
  'CHK_session_cloud_run_status',
  `status IN ('starting', 'running', 'finished', 'failed', 'cancelled', 'expired')`,
)
@Index('IDX_session_cloud_run_session', ['organizationId', 'sessionId'])
export class SessionCloudRunOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: CloudAgentProviderId;

  /** The vendor's id for the agent (Cursor's `bc-<sessionId>`). */
  @Column({ type: 'varchar', length: 64 })
  externalId!: string;

  /** The agent's own page at the vendor, which the session's row opens. */
  @Column({ type: 'text', nullable: true })
  url!: string | null;

  @Column({ type: 'varchar', length: 500 })
  repositoryUrl!: string;

  @Column({ type: 'varchar', length: 64 })
  latestRunId!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: CloudAgentStatus;

  /** The branch the agent pushed, once it pushed one. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  branch!: string | null;

  @Column({ type: 'text', nullable: true })
  pullRequestUrl!: string | null;

  /** The agent's last reply, once its run ended. */
  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  /** When the vendor was last asked about the run. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  syncedAt!: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
