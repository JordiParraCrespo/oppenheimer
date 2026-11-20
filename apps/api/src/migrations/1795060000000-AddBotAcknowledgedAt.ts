import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a bot's sidebar row reads beyond its turns, as a session's group does:
 *
 * - `bot."lastReplyAt"`: when the bot last wrote words in a chat. Your own
 *   messages move `lastMessageAt` (the sidebar's line) but never this, so a
 *   message you sent never reads as unread. Null until its next reply: what
 *   it said before this migration is read anyway (below).
 * - `bot."acknowledgedAt"`: when the person last read its chat, as a
 *   session's acknowledged report is; opening the chat sets it, on any
 *   device. A reply newer than it is the blue dot; a turn that failed after
 *   it, the bot not working, the amber one. Backfilled to now, so nothing
 *   that happened before this migration lights a dot the day it ships.
 * - `IDX_bot_turn_ended`: a bot's last ended turn, newest first, which the
 *   sidebar's activity read asks for each bot; partial, so the queued and
 *   running turns it never asks about stay out of it.
 *
 * Both columns are nullable with no default, instant to add; the backfill
 * rewrites `bot`, a table of a workspace's handful of bots.
 */
export class AddBotAcknowledgedAt1795060000000 implements MigrationInterface {
  name = 'AddBotAcknowledgedAt1795060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bot" ADD COLUMN IF NOT EXISTS "lastReplyAt" timestamp with time zone`,
    );
    await queryRunner.query(
      `ALTER TABLE "bot" ADD COLUMN IF NOT EXISTS "acknowledgedAt" timestamp with time zone`,
    );
    await queryRunner.query(
      `UPDATE "bot" SET "acknowledgedAt" = now() WHERE "acknowledgedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bot_turn_ended" ON "bot_turn" ("organizationId", "botId", "endedAt") WHERE "endedAt" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bot_turn_ended"`);
    await queryRunner.query(`ALTER TABLE "bot" DROP COLUMN IF EXISTS "acknowledgedAt"`);
    await queryRunner.query(`ALTER TABLE "bot" DROP COLUMN IF EXISTS "lastReplyAt"`);
  }
}
