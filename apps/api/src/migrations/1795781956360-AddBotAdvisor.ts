import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot can consult an advisor, a stronger Claude model, mid-turn
 * (Anthropic's advisor tool, 2026-11-27).
 *
 * - `bot."advisorModel"` is the model it consults, one its own model lists
 *   (`BotModel.advisors`), or null for none. It is nullable with no default,
 *   so every bot stored keeps running without one, and `varchar(128)` is
 *   `"model"`'s length. Which pair is valid is the catalog's, which moves
 *   with Anthropic's table, so it is checked when the bot is saved
 *   (`resolveBotEngine`) and again when a turn runs, never in a `CHECK`.
 * - A turn reads the advisor from its bot when it runs rather than copying
 *   it at creation as it copies the model and effort, so `bot_turn` gains no
 *   column; a turn whose copied model does not take the bot's advisor runs
 *   without one.
 * - What the advisor spends is priced as its own model, not the turn's, so
 *   it is counted with the bot's other model calls under a purpose of its
 *   own (`advisor`), with the advisor's model, rather than added to the
 *   turn's counts; `/usage` shows it as that model's share.
 *
 * `down()` drops the advisor's rows first, then restores the purpose check
 * without it, then the column.
 */
export class AddBotAdvisor1795781956360 implements MigrationInterface {
  name = 'AddBotAdvisor1795781956360';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot" ADD COLUMN "advisorModel" varchar(128)`);
    await queryRunner.query(
      `ALTER TABLE bot_model_call DROP CONSTRAINT "CHK_bot_model_call_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call ADD CONSTRAINT "CHK_bot_model_call_purpose" CHECK (purpose IN ('goal_review', 'summary', 'rule_review', 'dream', 'suggestion', 'auto_review', 'advisor'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM bot_model_call WHERE purpose = 'advisor'`);
    await queryRunner.query(
      `ALTER TABLE bot_model_call DROP CONSTRAINT "CHK_bot_model_call_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call ADD CONSTRAINT "CHK_bot_model_call_purpose" CHECK (purpose IN ('goal_review', 'summary', 'rule_review', 'dream', 'suggestion', 'auto_review'))`,
    );
    await queryRunner.query(`ALTER TABLE "bot" DROP COLUMN "advisorModel"`);
  }
}
