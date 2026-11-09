import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot's work has no fixed length (`product/versions/mvp/25-bots.md` §2 and
 * §4.1, 2026-11-09; `research/lessons-from-long-running-agents.md`): a turn
 * has no step or time limit, and a goal no limit of continuations. What stops
 * work that goes wrong is a guard or a pause, not a count.
 *
 * `bot_turn`:
 * - `CHK_bot_turn_failure` gains `stalled` (the model sent nothing for five
 *   minutes while no tool ran) and `loop` (the loop guard refused too many
 *   calls). `time_limit` and `step_limit` stay for the turns that carry them.
 *
 * `bot_goal`:
 * - `"limit"` becomes nullable: a new goal has none. A goal set before keeps
 *   its limit and ends when it runs out, as it was promised.
 * - `"tokensUsed"` / `"tokenBudget"`: what its turns spent, input and output,
 *   and the optional budget past which it pauses. bigint: a goal can run for
 *   days, and a turn's input counts every cached read.
 * - `"idleTurns"`: its turns in a row that called no tool; three pause it.
 * - `"claim"`: the bot's words when it said the goal is met; the reviewer
 *   checks them when the turn ends.
 * - `"pausedAt"`, `"pauseReason"`, `"pauseNote"`: a paused goal keeps its
 *   place until the owner resumes it. Both or neither of the time and the
 *   reason (`CHK_bot_goal_paused`).
 *
 * No index: the goal is read by `UQ_bot_goal_bot` alone, one row per bot.
 * Down drops the new columns and puts the old checks back; a goal with no
 * limit takes 20, the old most, and a `stalled` or `loop` turn reads as `other`.
 */
export class UnboundBotGoalsAndTurns1794209397887 implements MigrationInterface {
  name = 'UnboundBotGoalsAndTurns1794209397887';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_turn" DROP CONSTRAINT "CHK_bot_turn_failure"`);
    await queryRunner.query(`
      ALTER TABLE "bot_turn" ADD CONSTRAINT "CHK_bot_turn_failure" CHECK (
        "failure" IS NULL OR "failure" IN (
          'rate_limit', 'usage_limit', 'credential', 'refused', 'unavailable',
          'time_limit', 'step_limit', 'stalled', 'loop', 'interrupted', 'storage', 'other'
        )
      )
    `);

    await queryRunner.query(`ALTER TABLE "bot_goal" DROP CONSTRAINT "CHK_bot_goal_limit"`);
    await queryRunner.query(`ALTER TABLE "bot_goal" DROP CONSTRAINT "CHK_bot_goal_continuations"`);
    await queryRunner.query(`ALTER TABLE "bot_goal" ALTER COLUMN "limit" DROP NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "bot_goal"
        ADD COLUMN "tokensUsed" bigint NOT NULL DEFAULT 0,
        ADD COLUMN "tokenBudget" bigint,
        ADD COLUMN "idleTurns" integer NOT NULL DEFAULT 0,
        ADD COLUMN "claim" varchar(1000),
        ADD COLUMN "pausedAt" timestamptz,
        ADD COLUMN "pauseReason" varchar(16),
        ADD COLUMN "pauseNote" varchar(500),
        ADD CONSTRAINT "CHK_bot_goal_limit" CHECK ("limit" IS NULL OR "limit" >= 1),
        ADD CONSTRAINT "CHK_bot_goal_continuations" CHECK (
          continuations >= 0 AND ("limit" IS NULL OR continuations <= "limit")
        ),
        ADD CONSTRAINT "CHK_bot_goal_tokens" CHECK (
          "tokensUsed" >= 0 AND ("tokenBudget" IS NULL OR "tokenBudget" >= 50000)
        ),
        ADD CONSTRAINT "CHK_bot_goal_idle_turns" CHECK ("idleTurns" >= 0),
        ADD CONSTRAINT "CHK_bot_goal_pause_reason" CHECK (
          "pauseReason" IS NULL OR "pauseReason" IN (
            'blocked', 'usage_limit', 'no_progress', 'budget', 'stopped', 'failed'
          )
        ),
        ADD CONSTRAINT "CHK_bot_goal_paused" CHECK (num_nonnulls("pausedAt", "pauseReason") IN (0, 2))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bot_goal"
        DROP CONSTRAINT "CHK_bot_goal_paused",
        DROP CONSTRAINT "CHK_bot_goal_pause_reason",
        DROP CONSTRAINT "CHK_bot_goal_idle_turns",
        DROP CONSTRAINT "CHK_bot_goal_tokens",
        DROP CONSTRAINT "CHK_bot_goal_continuations",
        DROP CONSTRAINT "CHK_bot_goal_limit",
        DROP COLUMN "pauseNote",
        DROP COLUMN "pauseReason",
        DROP COLUMN "pausedAt",
        DROP COLUMN "claim",
        DROP COLUMN "idleTurns",
        DROP COLUMN "tokenBudget",
        DROP COLUMN "tokensUsed"
    `);
    await queryRunner.query(
      `UPDATE "bot_goal" SET "limit" = GREATEST(20, continuations) WHERE "limit" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "bot_goal" SET "limit" = 20, continuations = LEAST(continuations, 20)`,
    );
    await queryRunner.query(`ALTER TABLE "bot_goal" ALTER COLUMN "limit" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "bot_goal" ADD CONSTRAINT "CHK_bot_goal_limit" CHECK ("limit" BETWEEN 1 AND 20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bot_goal" ADD CONSTRAINT "CHK_bot_goal_continuations" CHECK (continuations BETWEEN 0 AND "limit")`,
    );

    await queryRunner.query(
      `UPDATE "bot_turn" SET "failure" = 'other' WHERE "failure" IN ('stalled', 'loop')`,
    );
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
}
