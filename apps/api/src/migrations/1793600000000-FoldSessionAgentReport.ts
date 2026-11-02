import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The agent's own word on what it is doing, folded from the `program` of the
 * log's `agent.observed` entries: what it reported through OSC 7501 (the
 * Program Status Protocol), which the runner's `pty` wrapper keeps
 * (`product/research/lessons-from-herdr.md`).
 *
 * - One nullable `jsonb` value, like `pendingDecision`: read and written
 *   whole, parsed by its schema (`SessionAgentReport`) on the way in, bounded
 *   by the event payload it came in (8 KB).
 * - No index: it is read with its row, never searched.
 * - No backfill: it is current state, and every open session's runner reports
 *   it again on its next poll.
 */
export class FoldSessionAgentReport1793600000000 implements MigrationInterface {
  name = 'FoldSessionAgentReport1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session ADD COLUMN "agentReport" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session DROP COLUMN "agentReport"`);
  }
}
