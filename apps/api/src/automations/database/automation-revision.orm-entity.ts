import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** What a run executes, immutable and numbered (`1790600000000-AddAutomations`). Append-only. */
@Entity('automation_revision')
@Unique('UQ_automation_revision_automation_number', ['automationId', 'number'])
@Unique('UQ_automation_revision_organization_id', ['organizationId', 'id'])
@Index('IDX_automation_revision_automation', ['organizationId', 'automationId'])
@Index('IDX_automation_revision_host', ['hostId'])
@Index('IDX_automation_revision_created_by', ['createdByUserId'], {
  where: '"createdByUserId" IS NOT NULL',
})
export class AutomationRevisionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  automationId!: string;

  @Column({ type: 'integer' })
  number!: number;

  @Column({ type: 'uuid' })
  hostId!: string;

  @Column({ type: 'varchar', length: 32 })
  agent!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar', length: 8, default: 'auto' })
  permission!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  effort!: string | null;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'jsonb' })
  repositories!: unknown;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
