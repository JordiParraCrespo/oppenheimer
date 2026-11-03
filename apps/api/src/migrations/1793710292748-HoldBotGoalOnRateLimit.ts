import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A goal waiting out a system's rate limit (`product/versions/mvp/25-bots.md`
 * §4, "Rate limits"). A turn of a goal that ended on a limit holds the goal's
 * next decision until the limit ends (its outbox job is staged with
 * `availableAt`); the goal says so, so the chat's goal banner can read
 * "waiting for Gmail until 10:02" rather than look stalled.
 *
 * - `waitingFor` is the system ("Gmail", "GitHub"), as the integration names
 *   itself; 64 characters is far past any of them. `waitingUntil` is when the
 *   held decision runs.
 * - Both or neither (`CHK_bot_goal_waiting`): a wait with no time, or a time
 *   with no system, is nothing the banner can say.
 * - Written in the transaction that stages the held job, and cleared in the
 *   one that claims the next continuation, so the row says what the queue
 *   holds. A goal that ends is deleted, its wait with it.
 * - No index: the columns are read with the goal's row, which the bot's own
 *   unique (`UQ_bot_goal_bot`) finds.
 */
export class HoldBotGoalOnRateLimit1793710292748 implements MigrationInterface {
  name = 'HoldBotGoalOnRateLimit1793710292748';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bot_goal ADD COLUMN "waitingFor" varchar(64), ADD COLUMN "waitingUntil" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_goal ADD CONSTRAINT "CHK_bot_goal_waiting" CHECK (num_nonnulls("waitingFor", "waitingUntil") IN (0, 2))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_goal DROP CONSTRAINT "CHK_bot_goal_waiting"`);
    await queryRunner.query(
      `ALTER TABLE bot_goal DROP COLUMN "waitingUntil", DROP COLUMN "waitingFor"`,
    );
  }
}
