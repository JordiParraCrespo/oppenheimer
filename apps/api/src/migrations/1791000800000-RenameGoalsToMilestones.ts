import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan's goals are milestones (`product/versions/mvp/23-plan-milestones-stats-accounts.md`
 * §2): the table, the task's column, and every constraint and index named
 * after them. Renames are catalog changes only, no rewrite and no long lock.
 * The task's composite foreign key keeps its `ON DELETE SET NULL` column list
 * through the column rename, since Postgres holds it by attribute number.
 */
export class RenameGoalsToMilestones1791000800000 implements MigrationInterface {
  name = 'RenameGoalsToMilestones1791000800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of RENAMES) await queryRunner.query(statement.up);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of [...RENAMES].reverse()) await queryRunner.query(statement.down);
  }
}

const RENAMES = [
  { up: 'ALTER TABLE goal RENAME TO milestone', down: 'ALTER TABLE milestone RENAME TO goal' },
  {
    up: 'ALTER TABLE milestone RENAME CONSTRAINT "PK_goal" TO "PK_milestone"',
    down: 'ALTER TABLE milestone RENAME CONSTRAINT "PK_milestone" TO "PK_goal"',
  },
  {
    up: 'ALTER TABLE milestone RENAME CONSTRAINT "UQ_goal_organization_id_project" TO "UQ_milestone_organization_id_project"',
    down: 'ALTER TABLE milestone RENAME CONSTRAINT "UQ_milestone_organization_id_project" TO "UQ_goal_organization_id_project"',
  },
  {
    up: 'ALTER TABLE milestone RENAME CONSTRAINT "FK_goal_project" TO "FK_milestone_project"',
    down: 'ALTER TABLE milestone RENAME CONSTRAINT "FK_milestone_project" TO "FK_goal_project"',
  },
  {
    up: 'ALTER TABLE milestone RENAME CONSTRAINT "FK_goal_created_by" TO "FK_milestone_created_by"',
    down: 'ALTER TABLE milestone RENAME CONSTRAINT "FK_milestone_created_by" TO "FK_goal_created_by"',
  },
  {
    up: 'ALTER INDEX "IDX_goal_project" RENAME TO "IDX_milestone_project"',
    down: 'ALTER INDEX "IDX_milestone_project" RENAME TO "IDX_goal_project"',
  },
  {
    up: 'ALTER INDEX "IDX_goal_created_by" RENAME TO "IDX_milestone_created_by"',
    down: 'ALTER INDEX "IDX_milestone_created_by" RENAME TO "IDX_goal_created_by"',
  },
  {
    up: 'ALTER TABLE task RENAME COLUMN "goalId" TO "milestoneId"',
    down: 'ALTER TABLE task RENAME COLUMN "milestoneId" TO "goalId"',
  },
  {
    up: 'ALTER TABLE task RENAME CONSTRAINT "FK_task_goal" TO "FK_task_milestone"',
    down: 'ALTER TABLE task RENAME CONSTRAINT "FK_task_milestone" TO "FK_task_goal"',
  },
  {
    up: 'ALTER INDEX "IDX_task_goal" RENAME TO "IDX_task_milestone"',
    down: 'ALTER INDEX "IDX_task_milestone" RENAME TO "IDX_task_goal"',
  },
];
