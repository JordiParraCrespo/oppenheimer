import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The copies of claude.ai logs the browser extension sent before the
 * newest-first rules (`1795866522360-AllowOlderCloudLines`) were numbered as
 * they arrived, and some arrived out of order: a long session read its newest
 * message hundreds of lines before the end. They are dropped here, the lines
 * with an `eventId`; the lines a session's hook sent are kept.
 *
 * claude.ai's log is the record, so nothing is lost: the extension's copy
 * rules moved on with this change (`CHAT_COPY_VERSION` 3), and it reads each
 * log again from its first page and sends it newest first into the empty copy.
 * A copy is never cleared by a request instead: two browsers syncing one
 * session would each undo the other's progress.
 *
 * `down()` restores nothing: the extension sends the copies again.
 */
export class DropUnorderedCloudCopies1795868441051 implements MigrationInterface {
  name = 'DropUnorderedCloudCopies1795868441051';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "session_cloud_line" WHERE "eventId" IS NOT NULL`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // The dropped copies are claude.ai's to send again; nothing to put back.
  }
}
