import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots: the scopes of the credential a turn's message was sent with
 * (`25-bots.md` §4). A bot's tools act as its owner, so a message sent through
 * an API token or OAuth grant scoped to `bots:write` must not reach, through
 * the bot, what the token itself could not: the turn keeps the token's scopes
 * and is offered only the tools they cover. Null is a browser session, which
 * carries no scopes and is governed by the owner's roles alone. A `jsonb` list
 * read whole with the turn; nothing filters on it, so no index.
 */
export class AddBotTurnCredentialScopes1791002100000 implements MigrationInterface {
  name = 'AddBotTurnCredentialScopes1791002100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn ADD COLUMN "credentialScopes" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "credentialScopes"`);
  }
}
