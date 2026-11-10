import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `CHK_bot_turn_failure` gains `context`: a turn whose context filled up past
 * what compaction could free (Claude Code's autocompact thrashing, its hard
 * limit, a prompt still too long after compacting). Claude Code reports
 * thrashing with the code it uses for an invalid request, so these turns read
 * as `refused`, and the chat told the person the provider had refused the
 * request and to change the message or the model. The provider refused
 * nothing; the turn read more than its window holds.
 *
 * No backfill: a turn stored as `refused` before this stays one, since its
 * kind cannot be told from its words alone. Down reads a `context` turn as
 * `refused`, what it was stored as before.
 */
export class AddBotTurnContextFailure1794271080349 implements MigrationInterface {
  name = 'AddBotTurnContextFailure1794271080349';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_turn" DROP CONSTRAINT "CHK_bot_turn_failure"`);
    await queryRunner.query(`
      ALTER TABLE "bot_turn" ADD CONSTRAINT "CHK_bot_turn_failure" CHECK (
        "failure" IS NULL OR "failure" IN (
          'rate_limit', 'usage_limit', 'credential', 'refused', 'unavailable', 'context',
          'time_limit', 'step_limit', 'stalled', 'loop', 'interrupted', 'storage', 'other'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "bot_turn" SET "failure" = 'refused' WHERE "failure" = 'context'`,
    );
    await queryRunner.query(`ALTER TABLE "bot_turn" DROP CONSTRAINT "CHK_bot_turn_failure"`);
    await queryRunner.query(`
      ALTER TABLE "bot_turn" ADD CONSTRAINT "CHK_bot_turn_failure" CHECK (
        "failure" IS NULL OR "failure" IN (
          'rate_limit', 'usage_limit', 'credential', 'refused', 'unavailable',
          'time_limit', 'step_limit', 'stalled', 'loop', 'interrupted', 'storage', 'other'
        )
      )
    `);
  }
}
