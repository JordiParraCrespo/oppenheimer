import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot turn whose transcript Postgres refused to store fails with its own
 * kind, `storage` (`product/versions/mvp/25-bots.md` §2), so the chat says the
 * failure was ours instead of "<provider> could not finish this turn" (#728).
 *
 * - `CHK_bot_turn_failure` gains `storage`. Rows already written keep the
 *   kinds they had: a turn that died on a refused write before this is `other`.
 * - Down puts the old check back; a `storage` row would break it, so they are
 *   read back as `other`, the kind the chat shows for one it does not know.
 */
export class AddBotTurnStorageFailure1794154621005 implements MigrationInterface {
  name = 'AddBotTurnStorageFailure1794154621005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_turn" DROP CONSTRAINT "CHK_bot_turn_failure"`);
    await queryRunner.query(`
      ALTER TABLE "bot_turn" ADD CONSTRAINT "CHK_bot_turn_failure" CHECK (
        "failure" IS NULL OR "failure" IN (
          'rate_limit', 'usage_limit', 'credential', 'refused', 'unavailable',
          'time_limit', 'step_limit', 'interrupted', 'storage', 'other'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "bot_turn" SET "failure" = 'other' WHERE "failure" = 'storage'`,
    );
    await queryRunner.query(`ALTER TABLE "bot_turn" DROP CONSTRAINT "CHK_bot_turn_failure"`);
    await queryRunner.query(`
      ALTER TABLE "bot_turn" ADD CONSTRAINT "CHK_bot_turn_failure" CHECK (
        "failure" IS NULL OR "failure" IN (
          'rate_limit', 'usage_limit', 'credential', 'refused',
          'unavailable', 'time_limit', 'step_limit', 'interrupted', 'other'
        )
      )
    `);
  }
}
