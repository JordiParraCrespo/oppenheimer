import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The inbound-events sweep: a delivery whose processing job ran out of
 * retries, or was lost with Redis, is still `received`, and the hub re-stages
 * it every few minutes until it is processed or a day old (then failed, where
 * a replay can find it).
 *
 * - `restagedAt` makes the re-stage at most once per window per delivery.
 * - `IDX_inbound_delivery_unprocessed` is partial on the status, so it holds
 *   only the handful of rows not yet processed and costs a processed delivery
 *   nothing. The table is young and small; built with it, not concurrently.
 */
export class AddInboundDeliverySweep1790700000000 implements MigrationInterface {
  name = 'AddInboundDeliverySweep1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inbound_delivery" ADD "restagedAt" timestamptz`);
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_delivery_unprocessed"
         ON "inbound_delivery" ("receivedAt") WHERE "status" = 'received'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_inbound_delivery_unprocessed"`);
    await queryRunner.query(`ALTER TABLE "inbound_delivery" DROP COLUMN "restagedAt"`);
  }
}
