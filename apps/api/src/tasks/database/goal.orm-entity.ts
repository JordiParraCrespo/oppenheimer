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
 * A goal over one project's tasks (`product/versions/mvp/19-plan-tasks-and-goals.md`
 * §1). `UQ_goal_organization_id_project` exists only as the target of the tasks'
 * goal key, which is what keeps a task's goal in the task's project.
 */
@Entity('goal')
@Unique('UQ_goal_organization_id_project', ['organizationId', 'id', 'projectId'])
@Index('IDX_goal_project', ['organizationId', 'projectId'])
@Index('IDX_goal_created_by', ['createdByUserId'], { where: '"createdByUserId" IS NOT NULL' })
export class GoalOrmEntity {
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
