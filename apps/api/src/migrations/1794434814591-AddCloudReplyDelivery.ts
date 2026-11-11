import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Which way a cloud session's reply reached its agent
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session",
 * decision 2): `hook`, collected by the session's Stop hook as before, or
 * `host`, sent from a host signed in to the session's claude.ai account with
 * `claude -p … --cloud <id>`, which wakes an idle session.
 *
 * - `session_cloud_reply."deliveredVia"`: set in the same statement that sets
 *   `collectedAt`, so one is null exactly when the other is
 *   (`CHK_session_cloud_reply_delivered`). Whichever way claims the row first
 *   (`collectedAt IS NULL` in the `UPDATE`) delivers it; the other finds
 *   nothing, which is what keeps a reply from reaching the agent twice. A
 *   host's send Claude Code certainly refused is handed back (both null
 *   again) for the hook. Rows collected before this column are the hook's.
 *
 * No new index: the wake reads one row by its primary key, and the hook's
 * claim stays on `IDX_session_cloud_reply_waiting`.
 */
export class AddCloudReplyDelivery1794434814591 implements MigrationInterface {
  name = 'AddCloudReplyDelivery1794434814591';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE session_cloud_reply ADD COLUMN "deliveredVia" varchar(8)`);
    await queryRunner.query(
      `UPDATE session_cloud_reply SET "deliveredVia" = 'hook' WHERE "collectedAt" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE session_cloud_reply
         ADD CONSTRAINT "CHK_session_cloud_reply_delivered_via" CHECK ("deliveredVia" IN ('hook', 'host')),
         ADD CONSTRAINT "CHK_session_cloud_reply_delivered" CHECK (("deliveredVia" IS NULL) = ("collectedAt" IS NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE session_cloud_reply
         DROP CONSTRAINT "CHK_session_cloud_reply_delivered",
         DROP CONSTRAINT "CHK_session_cloud_reply_delivered_via",
         DROP COLUMN "deliveredVia"`,
    );
  }
}
