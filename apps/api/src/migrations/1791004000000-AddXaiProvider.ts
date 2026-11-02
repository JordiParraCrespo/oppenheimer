import type { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  ['bot', 'CHK_bot_provider'],
  ['bot_turn', 'CHK_bot_turn_provider'],
  ['model_provider_credential', 'CHK_model_provider_credential_provider'],
] as const;

/**
 * Bots on Grok (`product/versions/mvp/25-bots.md` §2): `xai` joins the
 * providers a bot, a turn and a workspace credential may name. Its credential
 * is an xAI API key, a row like OpenAI's or GLM's, sealed under
 * `BOTS_PROVIDER_KEY`; no column is added.
 *
 * `down()` restores the four-provider checks, and so first removes the rows
 * that name `xai`: its credentials, and the bots and turns on it.
 */
export class AddXaiProvider1791004000000 implements MigrationInterface {
  name = 'AddXaiProvider1791004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, check] of TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${check}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${check}" CHECK ("provider" IN ('anthropic', 'glm', 'openai', 'chatgpt', 'xai'))`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "model_provider_credential" WHERE "provider" = 'xai'`);
    await queryRunner.query(`DELETE FROM "bot_turn" WHERE "provider" = 'xai'`);
    await queryRunner.query(`DELETE FROM "bot" WHERE "provider" = 'xai'`);
    for (const [table, check] of [...TABLES].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${check}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${check}" CHECK ("provider" IN ('anthropic', 'glm', 'openai', 'chatgpt'))`,
      );
    }
  }
}
