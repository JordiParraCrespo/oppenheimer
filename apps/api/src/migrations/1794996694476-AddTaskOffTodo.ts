import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A task its person took off To do: on no day's list, its due date included,
 * until it gets a TODO day again or its due date changes.
 *
 * - `boolean NOT NULL DEFAULT false`: every task is either on To do by its
 *   dates or taken off, so there is no third state to keep in a null.
 * - No index. To do and its count filter Plan's one read of the workspace's
 *   tasks in memory, which `IDX_task_project` serves.
 * - Instant to add: since Postgres 11 a constant default is stored in the
 *   catalog, not written to every row.
 */
export class AddTaskOffTodo1794996694476 implements MigrationInterface {
  name = 'AddTaskOffTodo1794996694476';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "offTodo" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN IF EXISTS "offTodo"`);
  }
}
