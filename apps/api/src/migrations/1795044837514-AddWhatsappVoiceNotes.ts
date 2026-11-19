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
 * - No index: both are read with the row they sit on, never searched by.
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "whatsapp_message" DROP COLUMN IF EXISTS "transcript"`);
    await queryRunner.query(`ALTER TABLE "whatsapp_message" DROP COLUMN IF EXISTS "voiceSeconds"`);
  }
}
