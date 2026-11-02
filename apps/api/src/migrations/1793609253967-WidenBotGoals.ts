import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A goal the person sets with `/goal` (`product/versions/mvp/25-bots.md`
 * §4.1, "Built-in commands"; from Claude Code's `/goal`).
 *
 * - `objective` grows from 500 to 2,000 characters: the person writes a
 *   condition with its check and its constraints ("`pnpm test` exits 0, and
 *   no other test file is modified"), which a sentence of the bot's never
 *   needed. Claude Code takes 4,000; 2,000 keeps a goal line and the
 *   reviewer's request small.
 * - `CHK_bot_goal_limit` goes from 1–10 to 1–20. A reviewer now ends a goal
 *   whose condition holds, so the limit is the bound on the spend rather than
 *   the bot's guess at how long the work takes, and a person's goal takes the
 *   whole of it.
 *
 * Nothing else changes: how a goal ended is still a line in the chat, so no
 * column records the reviewer's verdicts.
 */
export class WidenBotGoals1793609253967 implements MigrationInterface {
  name = 'WidenBotGoals1793609253967';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_goal ALTER COLUMN objective TYPE varchar(2000)`);
    await queryRunner.query(`ALTER TABLE bot_goal DROP CONSTRAINT "CHK_bot_goal_limit"`);
    await queryRunner.query(
      `ALTER TABLE bot_goal ADD CONSTRAINT "CHK_bot_goal_limit" CHECK ("limit" BETWEEN 1 AND 20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A goal past the old bounds is ended, as an ended goal is: deleted.
    await queryRunner.query(
      `DELETE FROM bot_goal WHERE "limit" > 10 OR char_length(objective) > 500`,
    );
    await queryRunner.query(`ALTER TABLE bot_goal DROP CONSTRAINT "CHK_bot_goal_limit"`);
    await queryRunner.query(
      `ALTER TABLE bot_goal ADD CONSTRAINT "CHK_bot_goal_limit" CHECK ("limit" BETWEEN 1 AND 10)`,
    );
    await queryRunner.query(`ALTER TABLE bot_goal ALTER COLUMN objective TYPE varchar(500)`);
  }
}
