import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A line the browser extension reads from a session's claude.ai log is now
 * numbered by its place in that log (`seq` = the event's position, from 0),
 * not by when it arrived. Every browser syncing a session reads the same log,
 * so each puts an event in the same place whatever order it sends it in: the
 * newest stretch first, so the console opens on the latest turn, then the
 * older ones below it; two browsers at once; a stretch sent again after a
 * failure. A place or an event id already held is skipped, never moved.
 *
 * The copies sent before this were numbered as they arrived, and some arrived
 * out of order (a long session read its newest message hundreds of lines
 * before the end). They are dropped here, the lines with an `eventId`; the
 * lines a session's hook sent are kept. claude.ai's log is the record: the
 * extension's copy rules moved on with this change, so it reads each log
 * again and sends it. `CHK_session_cloud_line_seq` holds as before; a branch
 * build that numbered older stretches below 0 dropped it, so it is restored.
 *
 * `down()` restores nothing: the extension sends the copies again.
 */
export class NumberCloudLinesByLogPosition1795869094871 implements MigrationInterface {
  name = 'NumberCloudLinesByLogPosition1795869094871';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "session_cloud_line" WHERE "eventId" IS NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "session_cloud_line" DROP CONSTRAINT IF EXISTS "CHK_session_cloud_line_seq"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session_cloud_line" ADD CONSTRAINT "CHK_session_cloud_line_seq" CHECK ("seq" >= 0)`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // The dropped copies are claude.ai's to send again; nothing to put back.
  }
}
