import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two defences on the GitHub webhook, whose HMAC covers the body and nothing
 * else: `X-GitHub-Delivery` and `X-GitHub-Event` are unsigned headers.
 *
 * - **Replay under a fresh delivery id.** `inbound_delivery` was unique on
 *   `(source, deliveryId)` only, so anyone who had seen one signed body could
 *   post the same bytes and signature with a new id and get a new delivery,
 *   new events and new automation runs. `payloadDigest` is the SHA-256 of the
 *   raw bytes (not the `jsonb` payload, which normalizes), and
 *   `UQ_inbound_delivery_source_payload` makes the same signed bytes one
 *   delivery whatever id they claim; the insert is a bare `ON CONFLICT DO
 *   NOTHING` over both uniques. Partial on `IS NOT NULL` so rows from before
 *   this migration are left alone. Retention (7 days) bounds the window it
 *   covers; past it, the processing step drops events older than the window.
 *   The table holds at most those 7 days, so the index is built with the
 *   migration rather than concurrently.
 * - **Out-of-order `installation` events.** They bypass the hub and were
 *   applied with receipt time, so a late retry of an old `suspend` (or a
 *   replay of one) could undo a newer `unsuspend`. `statusChangedAt` is
 *   GitHub's own time of the last suspend/unsuspend a row applied; the
 *   conditional update applies one only when it is at least as new. NULL
 *   until the first. An uninstall is terminal and ignores it.
 *
 * Both columns are nullable, so adding them is instant on a populated table.
 */
export class HardenGithubWebhookIngest1790860000000 implements MigrationInterface {
  name = 'HardenGithubWebhookIngest1790860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inbound_delivery" ADD "payloadDigest" varchar(64)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_inbound_delivery_source_payload"
         ON "inbound_delivery" ("source", "payloadDigest") WHERE "payloadDigest" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "github_installation" ADD "statusChangedAt" timestamptz`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "github_installation" DROP COLUMN "statusChangedAt"`);
    await queryRunner.query(`DROP INDEX "UQ_inbound_delivery_source_payload"`);
    await queryRunner.query(`ALTER TABLE "inbound_delivery" DROP COLUMN "payloadDigest"`);
  }
}
