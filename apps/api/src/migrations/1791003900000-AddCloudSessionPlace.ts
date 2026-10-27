import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cloud sessions (`product/research/cloud-agents.md` §5B): `work_session.place`
 * admits `cloud`, a session its host starts in Claude Code's cloud and then
 * keeps nothing of. Its Claude Code id is the row's `agentSessionId`, which
 * `session.started` already folds; no column is added.
 *
 * The access pattern it brings is the browser extension's status report: "these
 * cloud ids, in this workspace" (`POST /sessions/cloud-status`). It is served by
 * a partial index on the id over cloud rows only, which every other place leaves
 * out.
 */
export class AddCloudSessionPlace1791003900000 implements MigrationInterface {
  name = 'AddCloudSessionPlace1791003900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_place"`);
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_place" CHECK (place IN ('worktree', 'folder', 'cloud'))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_work_session_cloud_id" ON work_session ("organizationId", "agentSessionId") WHERE place = 'cloud'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_work_session_cloud_id"`);
    await queryRunner.query(`DELETE FROM work_session WHERE place = 'cloud'`);
    await queryRunner.query(`ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_place"`);
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_place" CHECK (place IN ('worktree', 'folder'))`,
    );
  }
}
