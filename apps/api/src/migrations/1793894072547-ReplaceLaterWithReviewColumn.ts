import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan's board drops the Later column and gains In review, between In progress
 * and Done (`product/versions/mvp/18-plan-product.md`, "Columns").
 *
 * - Every task in Later moves to the end of To do, keeping its order. A rank is
 *   a fractional key that sorts byte by byte (`task-rank.policy.ts`), so the
 *   moved key is the column's last To do key followed by the task's own Later
 *   key: it sorts after every To do key (a longer string with that prefix), the
 *   moved tasks keep their order among themselves (same prefix), it ends in the
 *   Later key's last digit (never `0`), and no two collide (`UQ_task_rank`).
 *   The version is bumped, so a client that read the task in Later is refused
 *   (`TASKS_008`) rather than writing over the move.
 * - Down moves In review to the end of In progress the same way, then puts the
 *   old check back. It does not put the moved tasks back in Later: nothing
 *   marks which To do tasks came from there, and a marker column kept only
 *   for a rollback is not worth its weight. A deliberate exception to
 *   `down()` restoring what a backfill moved (`database-design.md`).
 */
export class ReplaceLaterWithReviewColumn1793894072547 implements MigrationInterface {
  name = 'ReplaceLaterWithReviewColumn1793894072547';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE task DROP CONSTRAINT "CHK_task_status"`);
    await this.moveColumn(queryRunner, 'later', 'todo');
    await queryRunner.query(
      `ALTER TABLE task ADD CONSTRAINT "CHK_task_status" CHECK (status IN ('todo', 'doing', 'review', 'done'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE task DROP CONSTRAINT "CHK_task_status"`);
    await this.moveColumn(queryRunner, 'review', 'doing');
    await queryRunner.query(
      `ALTER TABLE task ADD CONSTRAINT "CHK_task_status" CHECK (status IN ('later', 'todo', 'doing', 'done'))`,
    );
  }

  private async moveColumn(queryRunner: QueryRunner, from: string, to: string): Promise<void> {
    await queryRunner.query(
      `UPDATE task SET
         status = $2::varchar,
         rank = COALESCE(
           (SELECT max(other.rank) FROM task other
             WHERE other."organizationId" = task."organizationId" AND other.status = $2::varchar),
           ''
         ) || task.rank,
         version = version + 1,
         "updatedAt" = now()
       WHERE status = $1::varchar`,
      [from, to],
    );
  }
}
