import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where a session runs (`product/versions/mvp/24-session-places.md`): a new
 * `worktree` the runner makes for each checkout, as every session was until
 * now, or a `folder` already on the host, where nothing is cloned or written.
 *
 * `place` is a closed vocabulary with a `CHECK`, defaulted to `worktree` so
 * every existing row keeps meaning what it meant. `folderPath` is the
 * person's own absolute path on the host, so `text` (a path has no real
 * limit below the 4096 bytes the request schema already holds it to), and
 * it is set exactly when the place is `folder`. Both are immutable after the
 * insert, like `agent` and `hostId`: not projections of the log.
 *
 * Access pattern: the folder picker's recent folders, "this person's folder
 * sessions on this host, newest first", read as the distinct paths with
 * their latest `createdAt` (`IDX_work_session_recent_folders`). The index is
 * partial on the place, so worktree sessions, the bulk of the table, cost it
 * nothing; it is written once per insert and never on a fold, because none
 * of its columns move. The direction is the B-tree scanned backwards, so no
 * `DESC` (`database-design.md`).
 */
export class AddSessionPlaces1791001300000 implements MigrationInterface {
  name = 'AddSessionPlaces1791001300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE work_session ADD COLUMN place character varying(16) NOT NULL DEFAULT 'worktree'`,
    );
    await queryRunner.query(`ALTER TABLE work_session ADD COLUMN "folderPath" text`);
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_place" CHECK (place IN ('worktree', 'folder'))`,
    );
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_folder_path" CHECK ((place = 'folder') = ("folderPath" IS NOT NULL))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_work_session_recent_folders" ON work_session USING btree ("hostId", "createdByUserId", "createdAt") WHERE place = 'folder'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_work_session_recent_folders"');
    await queryRunner.query(
      'ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_folder_path"',
    );
    await queryRunner.query('ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_place"');
    await queryRunner.query('ALTER TABLE work_session DROP COLUMN "folderPath"');
    await queryRunner.query('ALTER TABLE work_session DROP COLUMN place');
  }
}
