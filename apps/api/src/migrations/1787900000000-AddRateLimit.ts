import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table backing Better Auth's database rate limiter (`rateLimit.storage:
 * 'database'`). Better Auth owns this table — like `session`/`verification` it
 * is created by migration but is not a TypeORM entity. Database storage (rather
 * than the default in-memory store) is what makes the limit hold across
 * horizontally-scaled API replicas, and survive restarts.
 *
 * The columns match Better Auth's rate-limit model: `key` (the client+path
 * bucket), `count` (requests in the window) and `lastRequest` (epoch ms, hence
 * bigint). `id` is a uuid to match `advanced.database.generateId`.
 */
export class AddRateLimit1787900000000 implements MigrationInterface {
  name = 'AddRateLimit1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rateLimit" ("id" uuid NOT NULL, "key" character varying, "count" integer, "lastRequest" bigint, CONSTRAINT "PK_rateLimit_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_rateLimit_key" ON "rateLimit" ("key")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_rateLimit_key"`);
    await queryRunner.query(`DROP TABLE "rateLimit"`);
  }
}
