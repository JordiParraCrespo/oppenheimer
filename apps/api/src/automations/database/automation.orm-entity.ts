import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('automation')
@Unique('UQ_automation_organization_id', ['organizationId', 'id'])
@Index('IDX_automation_project', ['organizationId', 'projectId'])
@Index('IDX_automation_owner', ['ownerUserId'])
@Index('IDX_automation_current_revision', ['currentRevisionId'])
@Index('IDX_automation_bot', ['organizationId', 'botId'], { where: '"botId" IS NOT NULL' })
export class AutomationOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  /** Null only for a bot routine (`1791002600000-AddBotRoutines`). */
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  /** What its runs start: `session` or `bot`. */
  @Column({ type: 'varchar', length: 16, default: 'session' })
  runTarget!: string;

  /** The bot a routine wakes; set exactly when `runTarget` is `bot`. */
  @Column({ type: 'uuid', nullable: true })
  botId!: string | null;

  /** The scopes of the credential that saved it; null for a browser session. Read whole. */
  @Column({ type: 'jsonb', nullable: true })
  credentialScopes!: string[] | null;

  @Column({ type: 'uuid' })
  ownerUserId!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'uuid' })
  currentRevisionId!: string;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  pausedAt!: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  pausedReason!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  overlap!: string | null;

  @Column({ type: 'integer', nullable: true })
  maxRunsPerHour!: number | null;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
