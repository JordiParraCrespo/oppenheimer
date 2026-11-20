import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When the person last read a bot's chat (`bot."acknowledgedAt"`), as a
 * session's acknowledged report is: opening the chat sets it, on any device.
 * A bot whose last message is newer, and that is not working, is done with
 * something unread, the sidebar's blue dot; a turn that failed after it is
 * the amber one.
 *
 * - Nullable: null is never read, so a bot's first reply lights the dot.
 * - Backfilled to each bot's `lastMessageAt`, so nothing written before this
 *   migration lights a dot the day it ships.
 * - No index: read with the row, never searched by.
 */
export class AddBotAcknowledgedAt1795060000000 implements MigrationInterface {
  name = 'AddBotAcknowledgedAt1795060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bot" ADD COLUMN IF NOT EXISTS "acknowledgedAt" timestamp with time zone`,
    );
    await queryRunner.query(
      `UPDATE "bot" SET "acknowledgedAt" = "lastMessageAt" WHERE "acknowledgedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot" DROP COLUMN IF EXISTS "acknowledgedAt"`);
  }
}
