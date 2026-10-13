import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The model and token usage of a turn, for Plan's Stats
 * (`product/versions/mvp/23-plan-milestones-stats-accounts.md` §4, decided 3).
 *
 * `session_turn` kept `costUsd` and nothing about what produced it. A headless
 * turn's `turn.ended` now carries the model and the token counts Claude Code
 * reports (`turnEndedPayloadSchema` in `@oppenheimer/shared/protocol`), and the
 * turn fold writes them here beside the cost.
 *
 * - **Every column is nullable, and null means "not measured".** An interactive
 *   turn in tmux reports nothing, and another agent may not print usage; a zero
 *   would read as a turn that used no tokens. The console labels the gap
 *   ("Measured on headless turns") rather than this table inventing a value.
 * - **`bigint` for the counts.** One turn stays far below 2^31, but a turn's
 *   cache reads grow with the conversation and nothing bounds how long a
 *   session runs; the columns are summed per week, and a sum is `numeric`
 *   regardless. `pg` returns bigint as a string; the mapper reads it.
 * - **`model varchar(64)`**: the agent's own id (`claude-sonnet-4-5-20250929`).
 *   A longer one is dropped by the fold, never truncated into an id that names
 *   no model. There is no `CHECK` on its values: the set is the vendors', and it
 *   changes with every release.
 * - **No price list.** Cost stays the reported `costUsd`; the app never prices
 *   tokens itself, which would be a list somebody has to keep current.
 * - **`CHK_session_turn_tokens`**: a reported count is never negative.
 *
 * Access pattern: `SessionUsageReader.weeklyUsage` — one organization's turns
 * whose `endedAt` falls in a range (a week to a year), joined to
 * `work_session` on the composite key for `projectId`, grouped by week, project
 * and model. `IDX_session_turn_organization_ended` on
 * `("organizationId", "endedAt") WHERE "endedAt" IS NOT NULL` serves it: the
 * tenant equality first, then the range, and the partial predicate leaves out
 * the live turns that a range on `endedAt` can never match. The existing
 * `("organizationId", "sessionId")` index cannot serve a time range. A turn's
 * `endedAt` is written once, when it ends, so the index costs one entry per
 * turn and later updates of the row stay HOT.
 *
 * Plain `CREATE INDEX` and `ADD COLUMN` without defaults: migrations run at
 * boot in one transaction and no deployment holds turns anyone needs yet
 * (`database-design.md`, "While nothing is deployed"). Existing turns keep
 * null, which is the truth: nobody measured them.
 */
export class AddSessionTurnUsage1791001100000 implements MigrationInterface {
  name = 'AddSessionTurnUsage1791001100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session_turn"
         ADD COLUMN IF NOT EXISTS "model" varchar(64),
         ADD COLUMN IF NOT EXISTS "inputTokens" bigint,
         ADD COLUMN IF NOT EXISTS "outputTokens" bigint,
         ADD COLUMN IF NOT EXISTS "cacheReadTokens" bigint,
         ADD COLUMN IF NOT EXISTS "cacheWriteTokens" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "session_turn" ADD CONSTRAINT "CHK_session_turn_tokens" CHECK (
         ("inputTokens" IS NULL OR "inputTokens" >= 0) AND
         ("outputTokens" IS NULL OR "outputTokens" >= 0) AND
         ("cacheReadTokens" IS NULL OR "cacheReadTokens" >= 0) AND
         ("cacheWriteTokens" IS NULL OR "cacheWriteTokens" >= 0))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_turn_organization_ended"
         ON "session_turn" ("organizationId", "endedAt") WHERE "endedAt" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_turn_organization_ended"`);
    await queryRunner.query(
      `ALTER TABLE "session_turn" DROP CONSTRAINT IF EXISTS "CHK_session_turn_tokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session_turn"
         DROP COLUMN IF EXISTS "cacheWriteTokens",
         DROP COLUMN IF EXISTS "cacheReadTokens",
         DROP COLUMN IF EXISTS "outputTokens",
         DROP COLUMN IF EXISTS "inputTokens",
         DROP COLUMN IF EXISTS "model"`,
    );
  }
}
