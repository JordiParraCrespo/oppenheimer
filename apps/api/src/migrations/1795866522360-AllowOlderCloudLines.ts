import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A cloud session's copy of its claude.ai log is now sent newest first: the
 * browser extension reads the log, sends its newest stretch so the console
 * opens on the latest turn, then the older stretches one by one. Each older
 * stretch is numbered below the first line held, so `seq` may go below 0:
 * `CHK_session_cloud_line_seq` (`"seq" >= 0`) goes. The order of a session's
 * lines is still `seq`, served by the primary key; a read with no `from`
 * starts at the copy's first line, whatever its number.
 *
 * `down()` restores the check and drops the lines numbered below 0: those
 * copies lose their oldest stretches until the extension starts them again.
 */
export class AllowOlderCloudLines1795866522360 implements MigrationInterface {
  name = 'AllowOlderCloudLines1795866522360';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session_cloud_line" DROP CONSTRAINT IF EXISTS "CHK_session_cloud_line_seq"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "session_cloud_line" WHERE "seq" < 0`);
    await queryRunner.query(
      `ALTER TABLE "session_cloud_line" ADD CONSTRAINT "CHK_session_cloud_line_seq" CHECK ("seq" >= 0)`,
    );
  }
}
