import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot turn that used all its model round trips (`BOT_TURN_MAX_STEPS`) fails
 * with its own kind, `step_limit` (`product/versions/mvp/25-bots.md` §2), so
 * the chat says it stopped there instead of the turn ending as completed with
 * nothing said.
 *
 * - `CHK_bot_turn_failure` gains `step_limit`. Rows already written keep the
 *   kinds they had: a turn that ran out of steps before this is `completed`.
 * - Down puts the old check back; a `step_limit` row would break it, so they
 *   are read back as `other`, the kind the chat shows for one it does not know.
 */
export class AddBotTurnStepLimitFailure1794133874165 implements MigrationInterface {
  name = 'AddBotTurnStepLimitFailure1794133874165';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "bot_turn" SET "failure" = 'other' WHERE "failure" = 'step_limit'`,
    );
    await queryRunner.query(`ALTER TABLE "bot_turn" DROP CONSTRAINT "CHK_bot_turn_failure"`);
    await queryRunner.query(`
      ALTER TABLE "bot_turn" ADD CONSTRAINT "CHK_bot_turn_failure" CHECK (
        "failure" IS NULL OR "failure" IN (
          'rate_limit', 'usage_limit', 'credential', 'refused',
          'unavailable', 'time_limit', 'interrupted', 'other'
        )
      )
    `);
  }
}
