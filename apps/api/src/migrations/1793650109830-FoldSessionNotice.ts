import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The last line a session's agent sent the person, folded from the log's
 * `agent.notified` entries (`product/next-steps/agent-tools.md` §2), for the
 * Inbox.
 *
 * - One nullable `jsonb` value, like `agentReport`: read and written whole,
 *   parsed by its schema (`SessionNotice`) on the way in, bounded by the
 *   event payload it came in.
 * - No index: it is read with its row, never searched.
 * - No backfill: no runner has logged one before this.
 */
export class FoldSessionNotice1793650109830 implements MigrationInterface {
  name = 'FoldSessionNotice1793650109830';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session ADD COLUMN "notice" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session DROP COLUMN "notice"`);
  }
}
