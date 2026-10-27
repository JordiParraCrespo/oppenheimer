import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a session's agent waits on the person for, folded from the log's
 * `agent.decision` entries (`product/versions/mvp/28-inbox.md`, slice 4): an
 * `AskUserQuestion` call or a permission dialog, as the runner read it, so the
 * Inbox shows the question and answers it without walking a log.
 *
 * - One nullable `jsonb` value, not columns: it is a discriminated union
 *   (`SessionDecision` in `@oppenheimer/shared`) that is only ever read and
 *   written whole, and the fold parses it with that schema on the way in.
 *   Its size is bounded by the event payload it came in (8 KB).
 * - No index: it is read with its row, never searched.
 * - No backfill: a decision is current state, and every session open now is
 *   reported again by its runner the next time it polls a blocked agent.
 */
export class FoldSessionPendingDecision1791003800000 implements MigrationInterface {
  name = 'FoldSessionPendingDecision1791003800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session ADD COLUMN "pendingDecision" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session DROP COLUMN "pendingDecision"`);
  }
}
