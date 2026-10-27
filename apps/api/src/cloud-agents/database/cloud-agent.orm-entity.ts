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
 * A cloud agent launched from the console (`product/next-steps/cloud-agents.md`):
 * the vendor's agent, who launched it, and what the vendor last said about its
 * latest run. Only agents launched here are rows; one started at the vendor
 * (its web page, Slack, Linear) is not imported.
 *
 * The id is chosen before the vendor is asked and is also the vendor's agent
 * id (Cursor's `bc-<id>`), so a retried launch cannot start a second agent.
 * `("provider", "externalId")` is unique: one row per vendor agent.
 */
@Entity('cloud_agent')
@Unique('UQ_cloud_agent_external', ['provider', 'externalId'])
// The caller's own agents, newest first: the one list there is.
@Index('IDX_cloud_agent_owner', ['createdByUserId', 'organizationId', 'createdAt', 'id'])
@Index('IDX_cloud_agent_organization', ['organizationId'])
@Check('CHK_cloud_agent_provider', `"provider" IN ('cursor')`)
@Check(
  'CHK_cloud_agent_status',
  `"status" IN ('starting', 'running', 'finished', 'failed', 'cancelled', 'expired')`,
)
export class CloudAgentOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: CloudAgentProviderId;

  @Column({ type: 'varchar', length: 64 })
  externalId!: string;

  @Column({ type: 'text', nullable: true })
  url!: string | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'varchar', length: 500 })
  repositoryUrl!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  startingRef!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null;

  @Column({ type: 'boolean', default: false })
  autoCreatePr!: boolean;

  @Column({ type: 'varchar', length: 16 })
  status!: CloudAgentStatus;

  @Column({ type: 'varchar', length: 64 })
  latestRunId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branch!: string | null;

  @Column({ type: 'text', nullable: true })
  pullRequestUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  syncedAt!: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
