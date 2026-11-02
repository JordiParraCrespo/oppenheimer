import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How much room a bot's turn left (`product/versions/mvp/25-bots.md` §3,
 * the context meter): what the model's context held at the turn's last
 * answer, against its window, and a subscription's usage windows as that
 * answer said them.
 *
 * - `"contextTokens"`: what the last model call was sent, cached or not. It
 *   is not `"inputTokens"`, which sums every call the turn made. Null on a
 *   turn that ended before an answer, and on every turn before this one.
 * - `"contextWindow"`: the window the engine reported for the model (the
 *   Claude engine does; the OpenAI engine says none), so null is "unknown".
 * - `"planLimits"`: the 5-hour and weekly windows of a subscription sign-in
 *   (ChatGPT's), each `{ usedPercent, resetsAt }`, read whole and never
 *   filtered on, so `jsonb`. Null on a turn run on an API key.
 *
 * No index: the console reads them off the turns of the chat it already
 * loads. Nullable columns with no default are instant on a table with rows.
 */
export class AddBotTurnContext1791003400000 implements MigrationInterface {
  name = 'AddBotTurnContext1791003400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bot_turn
        ADD COLUMN "contextTokens" integer,
        ADD COLUMN "contextWindow" integer,
        ADD COLUMN "planLimits" jsonb,
        ADD CONSTRAINT "CHK_bot_turn_context" CHECK (
          ("contextTokens" IS NULL OR "contextTokens" >= 0)
          AND ("contextWindow" IS NULL OR "contextWindow" > 0)
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bot_turn
        DROP CONSTRAINT "CHK_bot_turn_context",
        DROP COLUMN "planLimits",
        DROP COLUMN "contextWindow",
        DROP COLUMN "contextTokens"
    `);
  }
}
