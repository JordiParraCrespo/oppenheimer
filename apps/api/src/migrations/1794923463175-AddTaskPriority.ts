import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A task's priority: urgent, high, medium or low, or none. It never orders
 * the board; a column's order stays the person's `rank`.
 *
 * - `varchar(16)` with a `CHECK`, as `status` and `origin` are: the names
 *   are what the API speaks, so nothing maps numbers back to them, and a fifth
 *   level is a new `CHECK`, not a renumbering.
 * - Nullable, no default: most tasks never get one, and null is "no priority".
 * - No index. Every reader sorts or filters Plan's one read of the workspace's
 *   tasks in memory, which `IDX_task_project` serves.
 * - Instant to add: a nullable column with no default, and a `CHECK` that
 *   every existing row (all null) passes.
 */
export class AddTaskPriority1794923463175 implements MigrationInterface {
  name = 'AddTaskPriority1794923463175';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "priority" varchar(16)`);
    await queryRunner.query(
      `ALTER TABLE "task" ADD CONSTRAINT "CHK_task_priority" CHECK ("priority" IN ('urgent', 'high', 'medium', 'low'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" DROP CONSTRAINT IF EXISTS "CHK_task_priority"`);
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN IF EXISTS "priority"`);
  }
}
