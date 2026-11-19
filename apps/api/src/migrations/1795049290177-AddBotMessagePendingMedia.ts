import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a turn's opening message still has to read when the turn starts
 * (`BotPendingMedia`): `{"kind":"whatsapp_voice_note"}` for the owner's
 * WhatsApp voice note, cleared once read. Typed data, so whether a turn reads
 * media never depends on the words the message shows meanwhile.
 *
 * - `jsonb`, nullable, like the row's `event`: the next kind (an image) adds a
 *   value, not a column; null is nothing pending, which is every row today.
 * - No index: read with the row it sits on, never searched by.
 * - Instant to add: a nullable column with no default writes no row.
 */
export class AddBotMessagePendingMedia1795049290177 implements MigrationInterface {
  name = 'AddBotMessagePendingMedia1795049290177';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bot_message" ADD COLUMN IF NOT EXISTS "pendingMedia" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_message" DROP COLUMN IF EXISTS "pendingMedia"`);
  }
}
