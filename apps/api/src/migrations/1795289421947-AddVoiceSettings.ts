import type { MigrationInterface, QueryRunner } from 'typeorm';

const OLD_PROVIDERS = `'anthropic', 'glm', 'openai', 'chatgpt', 'xai'`;
const NEW_PROVIDERS = `${OLD_PROVIDERS}, 'groq', 'elevenlabs'`;

/**
 * Voice on the workspace's own providers (Settings → Model providers).
 *
 * `model_provider_credential` takes two providers that only hear and speak:
 * Groq (Whisper transcription) and ElevenLabs (transcription and voices),
 * each an API key sealed like the others. They are not bot providers, so
 * `bot` and `bot_turn` keep their checks.
 *
 * `voice_settings` is one row per workspace, keyed by its organization, read
 * whole on each dictation and voice note and written whole from Settings, so
 * the primary key is its only index. Every column is nullable: null is
 * "automatic" (the provider order in `@oppenheimer/shared`, a provider's
 * default model and voice), and a workspace that never saved has no row. The
 * provider columns are checked against the ids the API knows; the model and
 * voice ids are the providers' own, checked against the catalog by the API
 * (a model a provider retires must not fail a migration). The row goes with
 * its workspace.
 *
 * `down()` drops the table, removes the two providers' keys and restores the
 * five-provider check.
 */
export class AddVoiceSettings1795289421947 implements MigrationInterface {
  name = 'AddVoiceSettings1795289421947';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "model_provider_credential" DROP CONSTRAINT "CHK_model_provider_credential_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "model_provider_credential" ADD CONSTRAINT "CHK_model_provider_credential_provider" CHECK ("provider" IN (${NEW_PROVIDERS}))`,
    );
    await queryRunner.query(`
      CREATE TABLE "voice_settings" (
        "organizationId" uuid NOT NULL,
        "transcriptionProvider" varchar(16),
        "transcriptionModel" varchar(64),
        "synthesisProvider" varchar(16),
        "synthesisModel" varchar(64),
        "synthesisVoice" varchar(64),
        "polishProvider" varchar(16),
        "polishModel" varchar(64),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voice_settings" PRIMARY KEY ("organizationId"),
        CONSTRAINT "FK_voice_settings_organization" FOREIGN KEY ("organizationId")
          REFERENCES "organization"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_voice_settings_transcription_provider" CHECK ("transcriptionProvider" IN ('chatgpt', 'openai', 'groq', 'elevenlabs', 'speech_key')),
        CONSTRAINT "CHK_voice_settings_synthesis_provider" CHECK ("synthesisProvider" IN ('openai', 'elevenlabs', 'speech_key')),
        CONSTRAINT "CHK_voice_settings_polish_provider" CHECK ("polishProvider" IN (${OLD_PROVIDERS}, 'off'))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "voice_settings"`);
    await queryRunner.query(
      `DELETE FROM "model_provider_credential" WHERE "provider" IN ('groq', 'elevenlabs')`,
    );
    await queryRunner.query(
      `ALTER TABLE "model_provider_credential" DROP CONSTRAINT "CHK_model_provider_credential_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "model_provider_credential" ADD CONSTRAINT "CHK_model_provider_credential_provider" CHECK ("provider" IN (${OLD_PROVIDERS}))`,
    );
  }
}
