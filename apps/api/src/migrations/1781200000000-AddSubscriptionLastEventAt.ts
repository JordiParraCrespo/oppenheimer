import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `lastEventAt` sequencing column to `subscription`.
 *
 * Stripe does not guarantee webhook delivery order, so the mirror records the
 * `created` timestamp of the last event it applied and discards anything older.
 * Added as its own migration rather than folded into `AddBilling` so databases
 * that already ran that migration pick the column up — TypeORM never re-runs a
 * migration it has recorded.
 */
export class AddSubscriptionLastEventAt1781200000000 implements MigrationInterface {
  name = 'AddSubscriptionLastEventAt1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription" ADD "lastEventAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription" DROP COLUMN "lastEventAt"`);
  }
}
