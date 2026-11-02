import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What kind of failure a failed bot turn was (`product/versions/mvp/25-bots.md`
 * §2, `BOT_TURN_FAILURES`), so the chat can say whether sending the message
 * again can help: a rate limit or an unreachable provider passes, a refused
 * key or a spent quota does not.
 *
 * - `bot_turn."failure"`: nullable, set only on a failed turn. `"error"`
 *   keeps the words; this keeps the kind. A `varchar` with a `CHECK` rather
 *   than a Postgres enum, as the table's other closed columns are.
 *
 * No index: nothing filters or sorts on it; it is read with the turn.
 * Turns that failed before this column existed read as no kind, which the
 * chat treats as `other`.
 */
export class AddBotTurnFailure1791004550000 implements MigrationInterface {
  name = 'AddBotTurnFailure1791004550000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_turn" ADD "failure" character varying(16)`);
    await queryRunner.query(`
      ALTER TABLE "bot_turn" ADD CONSTRAINT "CHK_bot_turn_failure" CHECK (
        "failure" IS NULL OR "failure" IN (
          'rate_limit', 'usage_limit', 'credential', 'refused',
          'unavailable', 'time_limit', 'interrupted', 'other'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_turn" DROP CONSTRAINT "CHK_bot_turn_failure"`);
    await queryRunner.query(`ALTER TABLE "bot_turn" DROP COLUMN "failure"`);
  }
}
