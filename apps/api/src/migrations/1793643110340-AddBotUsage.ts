import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a bot spends, for `/usage` (`product/versions/mvp/25-bots.md` §4.1,
 * "Built-in commands"; from Claude Code's `/usage`).
 *
 * - `bot_turn` gains `"cacheReadTokens"` and `"cacheWriteTokens"`: how much
 *   of `"inputTokens"` the provider read from its prompt cache, and wrote to
 *   it, as the engine reported them. They are part of `"inputTokens"`, not on
 *   top of it; a provider that says nothing leaves them 0. Turns from before
 *   this read 0, so a cache hit rate over them reads low, never wrong in the
 *   other direction.
 * - `bot_model_call`: the model calls a bot makes on its owner's key outside
 *   its turns: a goal's review, the conversation's summary, a review of the
 *   owner's rules. Without them `/usage` would leave out what a long goal
 *   spends judging itself. One row per call, written after it answers; a
 *   failed call reported nothing and writes nothing.
 *
 * Retention: append-only, one row per review or summary, so a bot has at
 * most a few per turn. Rows go with the bot (`CASCADE`) and with its chat:
 * clearing the conversation deletes them with the turns, so `/usage` always
 * counts the same chat. Not a partitioning candidate at that rate.
 *
 * Access patterns:
 * - `/usage`: a bot's calls summed by purpose and model,
 *   `IDX_bot_model_call_bot`, which also backs the bot foreign key;
 * - a bot's turns summed by model: the existing `IDX_bot_turn_bot`.
 */
export class AddBotUsage1793643110340 implements MigrationInterface {
  name = 'AddBotUsage1793643110340';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bot_turn
        ADD COLUMN "cacheReadTokens" integer NOT NULL DEFAULT 0,
        ADD COLUMN "cacheWriteTokens" integer NOT NULL DEFAULT 0,
        ADD CONSTRAINT "CHK_bot_turn_cache_tokens"
          CHECK ("cacheReadTokens" >= 0 AND "cacheWriteTokens" >= 0)
    `);
    await queryRunner.query(`
      CREATE TABLE bot_model_call (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        purpose varchar(16) NOT NULL,
        provider varchar(16) NOT NULL,
        model varchar(128) NOT NULL,
        "inputTokens" integer NOT NULL DEFAULT 0,
        "outputTokens" integer NOT NULL DEFAULT 0,
        "cacheReadTokens" integer NOT NULL DEFAULT 0,
        "cacheWriteTokens" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_model_call" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_model_call_purpose" CHECK (purpose IN ('goal_review', 'summary', 'rule_review')),
        CONSTRAINT "CHK_bot_model_call_provider" CHECK (provider IN ('anthropic', 'glm', 'openai', 'chatgpt', 'xai')),
        CONSTRAINT "CHK_bot_model_call_tokens" CHECK (
          "inputTokens" >= 0 AND "outputTokens" >= 0 AND "cacheReadTokens" >= 0 AND "cacheWriteTokens" >= 0
        )
      )
    `);
    await queryRunner.query(
      `ALTER TABLE bot_model_call ADD CONSTRAINT "FK_bot_model_call_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_model_call_bot" ON bot_model_call ("organizationId", "botId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bot_model_call`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_cache_tokens"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn DROP COLUMN "cacheWriteTokens", DROP COLUMN "cacheReadTokens"`,
    );
  }
}
