import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A task's focus date: the day its person means to work on it, apart from
 * when it is due (`product/versions/mvp/20-plan-calendar.md` §6). Plan's To
 * do lists a task on its focus date and on every later day until it is done,
 * so work that takes days stays on the list without a range.
 *
 * - `date`, nullable: wall-clock like `dueDate`, read in the viewer's
 *   timezone, and most tasks are never on To do. Null is "not planned".
 * - No index. Every reader of it (To do, the sidebar's count) works from
 *   Plan's one read of the workspace's tasks, which `IDX_task_project`
 *   serves; nothing filters on it in SQL. A server-side "To do for a day"
 *   would add `("organizationId", "focusDate") WHERE "focusDate" IS NOT NULL`
 *   beside `IDX_task_due`.
 * - No backfill. Until a person plans a task, To do still shows it by its
 *   due date, as it did before this column.
 * - Instant to add: a nullable column with no default.
 */
export class AddTaskFocusDate1794241300581 implements MigrationInterface {
  name = 'AddTaskFocusDate1794241300581';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "focusDate" date`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN IF EXISTS "focusDate"`);
  }
}
