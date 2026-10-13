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

/**
 * A milestone over one project's tasks (`product/versions/mvp/19-plan-tasks-and-goals.md`
 * §1). `UQ_milestone_organization_id_project` exists only as the target of the tasks'
 * milestone key, which is what keeps a task's milestone in the task's project.
 */
@Entity('milestone')
@Unique('UQ_milestone_organization_id_project', ['organizationId', 'id', 'projectId'])
@Index('IDX_milestone_project', ['organizationId', 'projectId'])
@Index('IDX_milestone_created_by', ['createdByUserId'], { where: '"createdByUserId" IS NOT NULL' })
export class MilestoneOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'date', nullable: true })
  targetDate!: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
