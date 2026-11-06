import type { MigrationInterface, QueryRunner } from 'typeorm';

/** The rank alphabet, as `tasks/domain/task-rank.policy.ts` writes it. */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Plan's board drops the Later column and gains In review, between In progress
 * and Done (`product/versions/mvp/18-plan-product.md`, "Columns").
 *
 * - Every task in Later moves to the end of To do, keeping its order. A rank is
 *   a fractional key that sorts byte by byte (`task-rank.policy.ts`), so the
 *   n-th moved task gets the column's last To do key, then n in base 62 at a
 *   fixed width, then `V`. Each sorts after every To do key (a longer string
 *   with that prefix), the fixed width keeps them in their Later order, none
 *   ends in `0`, and no two collide (`UQ_task_rank`). The suffix is a few
 *   characters whatever the Later keys were, so the key stays within
 *   `varchar(128)`; a To do key already at the limit leaves no room for any
 *   append, and the migration fails loudly there rather than writing a bad key.
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
    const moving: { id: string; organizationId: string; last: string | null }[] =
      await queryRunner.query(
        `SELECT task.id, task."organizationId",
           (SELECT max(other.rank) FROM task other
             WHERE other."organizationId" = task."organizationId" AND other.status = $2::varchar) AS last
         FROM task WHERE task.status = $1::varchar
         ORDER BY task."organizationId", task.rank`,
        [from, to],
      );
    const byOrganization = new Map<string, typeof moving>();
    for (const row of moving) {
      byOrganization.set(row.organizationId, [
        ...(byOrganization.get(row.organizationId) ?? []),
        row,
      ]);
    }
    for (const rows of byOrganization.values()) {
      const width = Math.max(1, Math.ceil(Math.log(rows.length) / Math.log(DIGITS.length)));
      for (const [index, row] of rows.entries()) {
        await queryRunner.query(
          `UPDATE task SET status = $2::varchar, rank = $3, version = version + 1, "updatedAt" = now()
           WHERE id = $1`,
          [row.id, to, `${row.last ?? ''}${base62(index, width)}V`],
        );
      }
    }
  }
}

function base62(value: number, width: number): string {
  let digits = '';
  for (let rest = value; digits.length < width; rest = Math.floor(rest / DIGITS.length)) {
    digits = DIGITS[rest % DIGITS.length] + digits;
  }
  return digits;
}
