import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The files a session's agent shared, folded from the log's `file.shared`
 * entries (`product/next-steps/agent-tools.md` §7), for bots to list and show.
 *
 * - `jsonb`, not null, `[]` for none: the fold writes the whole list, the
 *   last twenty, each `{ id, name, mediaType, size, caption?, hasPreview, at }`
 *   (`SessionSharedFile`), never a host path nor the bytes.
 * - No index: it is read with its row, never searched.
 * - No backfill: no runner has logged one before this.
 */
export class FoldSessionSharedFiles1793707568655 implements MigrationInterface {
  name = 'FoldSessionSharedFiles1793707568655';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE work_session ADD COLUMN "sharedFiles" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session DROP COLUMN "sharedFiles"`);
  }
}
