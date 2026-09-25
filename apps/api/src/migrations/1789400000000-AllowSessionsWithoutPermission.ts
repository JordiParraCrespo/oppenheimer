import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `launchPermission` may be null: a session whose agent has no approvals.
 *
 * The blank terminal is a session with nothing launched in it, and the
 * catalog gives it no permission levels. Recording `ask` for it would be a
 * level carried over from whatever agent the composer had picked last — a
 * setting that means nothing on that session and would be read back as if it
 * did. Null is the honest value, and `launchPermissionFor` is the one rule
 * that writes it: null for such an agent, `ask` for an absent choice on any
 * other.
 *
 * The default stays `ask`. No existing row changes: every one was written for
 * an agent with approvals, at the level it states.
 *
 * `down` puts `ask` into the null rows before restoring `NOT NULL`, because the
 * code before this migration cannot read a null level; `ask` is the reading
 * that escalates nothing.
 */
export class AllowSessionsWithoutPermission1789400000000 implements MigrationInterface {
  name = 'AllowSessionsWithoutPermission1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_session" ALTER COLUMN "launchPermission" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "work_session" SET "launchPermission" = 'ask' WHERE "launchPermission" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_session" ALTER COLUMN "launchPermission" SET NOT NULL`,
    );
  }
}
