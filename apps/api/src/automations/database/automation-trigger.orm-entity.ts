import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** One trigger of an automation (`1790600000000-AddAutomations`). */
@Entity('automation_trigger')
@Index('IDX_automation_trigger_automation', ['automationId', 'organizationId', 'position'])
@Index('IDX_automation_trigger_match', ['organizationId', 'source', 'eventType'])
@Index('IDX_automation_trigger_due', ['nextFireAt'], { where: '"nextFireAt" IS NOT NULL' })
export class AutomationTriggerOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  automationId!: string;

  @Column({ type: 'smallint', default: 0 })
  position!: number;

  @Column({ type: 'varchar', length: 32 })
  source!: string;

  @Column({ type: 'varchar', length: 64 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  config!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  nextFireAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
