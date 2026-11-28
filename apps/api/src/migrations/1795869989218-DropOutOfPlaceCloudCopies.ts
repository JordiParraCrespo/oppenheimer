import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `1795869094871-NumberCloudLinesByLogPosition` dropped the copies numbered
 * by arrival, but a browser still running an extension built before places
 * filled some again, the old way, before it was reloaded: its batches came
 * without a place and were appended after the lines held, so a session's
 * newest event sat near the start of its copy, for good, since a place or an
 * id held is never moved. The API now refuses a batch without a place
 * (`recordCloudEventsSchema`), so this drops the extension's copies once more
 * (the lines with an `eventId`; the hook's are kept), and the extension, whose
 * copy rules moved on with this change, sends each log again at its places.
 *
 * `down()` restores nothing: the extension sends the copies again.
 */
export class DropOutOfPlaceCloudCopies1795869989218 implements MigrationInterface {
  name = 'DropOutOfPlaceCloudCopies1795869989218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "session_cloud_line" WHERE "eventId" IS NOT NULL`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // The dropped copies are claude.ai's to send again; nothing to put back.
  }
}
