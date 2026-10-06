import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { TaskStatus } from '@oppenheimer/shared';
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
 * A task on Plan's board (`product/versions/mvp/19-plan-tasks-and-goals.md` §1).
 *
 * `UQ_task_rank` is the board's order and its concurrency guard at once: two moves
 * into the same gap compute the same key, one loses on the constraint, and the move
 * reads its neighbours again (§2). `rank` is `COLLATE "C"` so the database sorts
 * the keys byte by byte, as the rank policy builds them.
 *
 * The goal key is one composite foreign key, `(organizationId, goalId, projectId)`
 * to the goal's `(organizationId, id, projectId)`: a task's goal is always of the
 * task's project; deleting a goal nulls only `goalId`; and moving a goal to another
 * project carries its tasks' `projectId` with it (`ON UPDATE CASCADE`).
 */
@Entity('task')
@Unique('UQ_task_rank', ['organizationId', 'status', 'rank'])
@Unique('UQ_task_organization_id', ['organizationId', 'id'])
@Index('IDX_task_project', ['organizationId', 'projectId'])
@Index('IDX_task_goal', ['organizationId', 'goalId', 'projectId'], {
  where: '"goalId" IS NOT NULL',
})
@Index('IDX_task_due', ['organizationId', 'dueDate'], { where: '"dueDate" IS NOT NULL' })
@Index('IDX_task_created_by', ['createdByUserId'], { where: '"createdByUserId" IS NOT NULL' })
@Check('CHK_task_status', `"status" IN ('later', 'todo', 'doing', 'done')`)
@Check('CHK_task_due_time', `"dueTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`)
@Check('CHK_task_due_time_has_date', `"dueTime" IS NULL OR "dueDate" IS NOT NULL`)
export class TaskOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'uuid', nullable: true })
  goalId!: string | null;

  @Column({ type: 'varchar', length: 16 })
  status!: TaskStatus;

  @Column({ type: 'varchar', length: 128, collation: 'C' })
  rank!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;

  /** A calendar day, read in the viewer's timezone; `date` comes back as `YYYY-MM-DD`. */
  @Column({ type: 'date', nullable: true })
  dueDate!: string | null;

  /** `HH:MM`, wall-clock like the date. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  dueTime!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
