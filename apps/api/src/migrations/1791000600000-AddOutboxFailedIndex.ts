import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The backlog gauge reads the parked rows on every sample.
 *
 * `OutboxService.backlog()` counts `pending` and `failed` rows and reads the
 * oldest pending `createdAt` in one statement, every
 * `METRICS_SAMPLE_INTERVAL_MS`. The pending half walks
 * `IDX_outbox_message_pending`; the failed half had no index, and since
 * retention never deletes a `failed` row (it is the inspection trail), its
 * count was a sequential scan of the whole table, run every 15 seconds.
 *
 * A partial index on `"createdAt"` `WHERE "status" = 'failed'` holds only the
 * parked rows, a handful in a healthy system, so the count is an index-only
 * scan over them; ordered by `createdAt`, it also serves "the oldest parked
 * rows" to whoever inspects them. `status` and `createdAt` never change once
 * a row is parked, and no lease or retry column is indexed, so claims and
 * renewals stay HOT updates.
 *
 * Plain `CREATE INDEX`, not `CONCURRENTLY`: migrations run at boot in one
 * transaction, which `CONCURRENTLY` cannot join, and no deployment holds
 * outbox rows anyone needs yet (`database-design.md`, "While nothing is
 * deployed"). Retention keeps the table to a week of rows either way.
 */
export class AddOutboxFailedIndex1791000600000 implements MigrationInterface {
  name = 'AddOutboxFailedIndex1791000600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_message_failed" ON "outbox_message" ("createdAt")
         WHERE "status" = 'failed'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_outbox_message_failed"`);
  }
}
