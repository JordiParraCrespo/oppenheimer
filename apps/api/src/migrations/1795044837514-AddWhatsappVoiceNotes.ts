import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Voice notes a linked number received, as the owner's bots hear them.
 *
 * - `voiceSeconds`: how long the note runs, as the runner reported it; null on
 *   every other message and on a voice note from a runner that cannot hand
 *   one over, which is how intake tells the two apart.
 * - `transcript`: what the note says, written once when a bot first needs it
 *   (`TranscribeWhatsappVoiceNoteCommand`) and read back by every later read,
 *   so a note is transcribed once. Null until then. `text` stays the caption
 *   WhatsApp sent, which is empty for a voice note: the two never mix.
 * - `bot_message."pendingMedia"`: what a turn's opening message still has to
 *   read when the turn starts (`{"kind":"whatsapp_voice_note"}`), cleared once
 *   read. `jsonb` like the row's `event`, so the next kind (an image) adds a
 *   value, not a column.
 * - No index: all three are read with the row they sit on, never searched by.
 * - Instant to add: nullable columns with no default write no row.
 */
export class AddWhatsappVoiceNotes1795044837514 implements MigrationInterface {
  name = 'AddWhatsappVoiceNotes1795044837514';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "whatsapp_message" ADD COLUMN IF NOT EXISTS "voiceSeconds" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_message" ADD COLUMN IF NOT EXISTS "transcript" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "bot_message" ADD COLUMN IF NOT EXISTS "pendingMedia" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_message" DROP COLUMN IF EXISTS "pendingMedia"`);
    await queryRunner.query(`ALTER TABLE "whatsapp_message" DROP COLUMN IF EXISTS "transcript"`);
    await queryRunner.query(`ALTER TABLE "whatsapp_message" DROP COLUMN IF EXISTS "voiceSeconds"`);
  }
}
