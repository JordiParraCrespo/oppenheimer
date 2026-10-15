import type { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  ['bot', 'CHK_bot_provider'],
  ['bot_turn', 'CHK_bot_turn_provider'],
  ['model_provider_credential', 'CHK_model_provider_credential_provider'],
] as const;

/**
 * Bots on a ChatGPT subscription (`product/versions/mvp/25-bots.md` §2):
 * `chatgpt` joins the providers a bot, a turn and a workspace credential may
 * name.
 *
 * Its credential is a row like any other provider's: one per workspace, the
 * secret sealed under `BOTS_PROVIDER_KEY`. What is sealed is the sign-in's
 * tokens (access, refresh, expiry, account) rather than a key, and the hint is
 * the account's last characters. The worker rotates the secret when it
 * refreshes the token, conditioned on the secret it read, so no column is
 * added: the sealed blob is the only thing that changes.
 *
 * `down()` restores the three-provider checks, and so first removes the rows
 * that name `chatgpt`: its credentials, and the bots and turns on it.
 */
export class AddChatgptProvider1791001900000 implements MigrationInterface {
  name = 'AddChatgptProvider1791001900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, check] of TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${check}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${check}" CHECK ("provider" IN ('anthropic', 'glm', 'openai', 'chatgpt'))`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "model_provider_credential" WHERE "provider" = 'chatgpt'`);
    await queryRunner.query(`DELETE FROM "bot_turn" WHERE "provider" = 'chatgpt'`);
    await queryRunner.query(`DELETE FROM "bot" WHERE "provider" = 'chatgpt'`);
    for (const [table, check] of [...TABLES].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${check}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${check}" CHECK ("provider" IN ('anthropic', 'glm', 'openai'))`,
      );
    }
  }
}
