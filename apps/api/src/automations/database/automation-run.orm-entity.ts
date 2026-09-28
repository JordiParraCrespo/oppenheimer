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

/** One firing of an automation (`1790600000000-AddAutomations`). */
@Entity('automation_run')
@Unique('UQ_automation_run_automation_cause', ['automationId', 'causeKey'])
@Index('IDX_automation_run_organization_created', ['organizationId', 'createdAt', 'id'])
@Index('IDX_automation_run_automation_created', [
  'organizationId',
  'automationId',
  'createdAt',
  'id',
])
@Index('IDX_automation_run_revision', ['organizationId', 'revisionId'])
@Index('IDX_automation_run_trigger', ['triggerId'], { where: '"triggerId" IS NOT NULL' })
@Index('IDX_automation_run_inbound_event', ['inboundEventId'], {
  where: '"inboundEventId" IS NOT NULL',
})
@Index('UQ_automation_run_session', ['sessionId'], {
  unique: true,
  where: '"sessionId" IS NOT NULL',
})
@Index('IDX_automation_run_organization_session', ['organizationId', 'sessionId'], {
  where: '"sessionId" IS NOT NULL',
})
@Index('IDX_automation_run_requested_by', ['requestedByUserId'], {
  where: '"requestedByUserId" IS NOT NULL',
})
@Index('IDX_automation_run_pending', ['availableAt'], { where: `"outcome" = 'pending'` })
export class AutomationRunOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  automationId!: string;

  @Column({ type: 'uuid' })
  revisionId!: string;

  @Column({ type: 'uuid', nullable: true })
  triggerId!: string | null;

  @Column({ type: 'varchar', length: 16 })
  cause!: string;

  @Column({ type: 'varchar', length: 200 })
  causeKey!: string;

  @Column({ type: 'jsonb', default: {} })
  causeSummary!: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  inboundEventId!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  scheduledFor!: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  outcome!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  skipReason!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  availableAt!: Date;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'uuid', nullable: true })
  sessionId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  requestedByUserId!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  dispatchedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
