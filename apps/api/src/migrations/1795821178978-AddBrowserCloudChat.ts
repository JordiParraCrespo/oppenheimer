import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A Claude Code cloud session's chat as the browser extension reads it:
 * claude.ai's own event log for the session, read with the person's claude.ai
 * sign-in, and the replies typed in the console handed to the extension to
 * send there as the person's message.
 *
 * - `session_cloud_line."eventId"`: the id claude.ai gives the event the line
 *   is (the transcript entry's `uuid`). Null for a line the session's hook
 *   sent, which is numbered by the hook. A session the extension has read
 *   keeps the extension's lines only: the first batch replaces the hook's
 *   copy, numbered from 0 again, and the hook's later appends store nothing.
 *   `UQ_session_cloud_line_event` on `(sessionId, eventId)` makes a batch the
 *   extension sends again after a failure a no-op, as the primary key does for
 *   the hook's.
 * - `session_cloud_reply."deliveredVia"` takes `browser`: the extension
 *   claimed the reply and posts it to the session on claude.ai. Its claim is
 *   the same `collectedAt IS NULL` update as the hook's and the host's, so
 *   only one of the three ever has a reply; a send claude.ai refused is
 *   handed back (both null again).
 * - `session_cloud_reply."leaseUntil"`: how long the extension's claim holds
 *   before the reply counts as waiting again, set with the claim and cleared
 *   when the extension says claude.ai took it. A claim whose answer was lost,
 *   or whose worker Chrome stopped before it posted, would otherwise keep the
 *   reply from the hook and the hosts for good. Only a `browser` claim has
 *   one (`CHK_session_cloud_reply_lease`). The hook's claim now takes a
 *   reply that waits or whose lease lapsed: `IDX_session_cloud_reply_waiting`
 *   serves the first, `IDX_session_cloud_reply_leased` the second, so the
 *   claim reads one session's rows and never the table.
 */
export class AddBrowserCloudChat1795821178978 implements MigrationInterface {
  name = 'AddBrowserCloudChat1795821178978';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE session_cloud_line ADD COLUMN "eventId" varchar(128)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_session_cloud_line_event"
         ON session_cloud_line ("sessionId", "eventId") WHERE "eventId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE session_cloud_reply
         DROP CONSTRAINT "CHK_session_cloud_reply_delivered_via",
         ADD CONSTRAINT "CHK_session_cloud_reply_delivered_via"
           CHECK ("deliveredVia" IN ('hook', 'host', 'browser')),
         ADD COLUMN "leaseUntil" timestamptz,
         ADD CONSTRAINT "CHK_session_cloud_reply_lease"
           CHECK ("leaseUntil" IS NULL OR "deliveredVia" = 'browser')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_cloud_reply_leased"
         ON session_cloud_reply ("sessionId", "leaseUntil")
         WHERE "deliveredVia" = 'browser' AND "leaseUntil" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A claim still leased was never confirmed posted: it waits again. One
    // confirmed was delivered, which the older schema can only call a host's.
    await queryRunner.query(
      `UPDATE session_cloud_reply SET "collectedAt" = NULL, "deliveredVia" = NULL, "leaseUntil" = NULL
        WHERE "leaseUntil" IS NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX "IDX_session_cloud_reply_leased"`);
    await queryRunner.query(
      `UPDATE session_cloud_reply SET "deliveredVia" = 'host' WHERE "deliveredVia" = 'browser'`,
    );
    await queryRunner.query(
      `ALTER TABLE session_cloud_reply
         DROP CONSTRAINT "CHK_session_cloud_reply_lease",
         DROP COLUMN "leaseUntil",
         DROP CONSTRAINT "CHK_session_cloud_reply_delivered_via",
         ADD CONSTRAINT "CHK_session_cloud_reply_delivered_via"
           CHECK ("deliveredVia" IN ('hook', 'host'))`,
    );
    await queryRunner.query(`DROP INDEX "UQ_session_cloud_line_event"`);
    await queryRunner.query(`ALTER TABLE session_cloud_line DROP COLUMN "eventId"`);
  }
}
