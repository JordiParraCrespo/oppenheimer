import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The pull requests a session's agent asked to be woken by, folded from the
 * log's `pull.watched` entries (`product/next-steps/agent-tools.md` §3).
 *
 * - `jsonb`, not null, `[]` for none: the fold writes the whole list, at most
 *   ten entries, each `{ githubRepoId, number }`.
 * - A partial index on the workspace, only over the rows that watch
 *   something: a GitHub event reads its workspace's watching sessions and
 *   filters the few with `@>`. The list changes rarely, so the index costs
 *   the fold's hot path nothing.
 * - No backfill: no runner has logged a watch before this.
 */
export class FoldSessionWatchedPulls1793650209830 implements MigrationInterface {
  name = 'FoldSessionWatchedPulls1793650209830';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE work_session ADD COLUMN "watchedPulls" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_work_session_watching_pulls" ON work_session ("organizationId") WHERE "watchedPulls" <> '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_work_session_watching_pulls"`);
    await queryRunner.query(`ALTER TABLE work_session DROP COLUMN "watchedPulls"`);
  }
}
