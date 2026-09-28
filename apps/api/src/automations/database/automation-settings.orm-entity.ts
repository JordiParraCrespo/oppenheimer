import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** The workspace's level of the automation limits; null is the platform default. */
@Entity('automation_settings')
export class AutomationSettingsOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'integer', nullable: true })
  maxRunsPerAutomationHour!: number | null;

  @Column({ type: 'integer', nullable: true })
  maxRunsPerWorkspaceHour!: number | null;

  @Column({ type: 'integer', nullable: true })
  liveRunsPerHost!: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  overlap!: string | null;

  @Column({ type: 'integer', nullable: true })
  staleTtlSeconds!: number | null;

  @Column({ type: 'integer', nullable: true })
  missedGraceSeconds!: number | null;

  @Column({ type: 'integer', nullable: true })
  maxRunSeconds!: number | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
