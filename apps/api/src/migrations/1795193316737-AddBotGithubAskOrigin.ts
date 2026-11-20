import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot turn gets one more origin, `github`: the owner's ask of a bot on
 * GitHub (a mention, a `bot:` label), whose answer is posted back there.
 * Only the check changes; no row is rewritten.
 */
export class AddBotGithubAskOrigin1795193316737 implements MigrationInterface {
  name = 'AddBotGithubAskOrigin1795193316737';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop', 'telegram', 'whatsapp', 'github'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM bot_turn WHERE "origin" = 'github'`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop', 'telegram', 'whatsapp'))`,
    );
  }
}
