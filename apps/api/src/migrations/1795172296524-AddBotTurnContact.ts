import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A contact's turn: a turn a bot runs for someone who is not its owner, a
 * person or a group a WhatsApp number allows
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §3). It is
 * queued on the owner's account, as every turn is, so `bot_turn."contact"`
 * is what tells the turn to run without the owner's tools or memory.
 *
 * Lock-safe on a table with rows: a `boolean NOT NULL` with a constant
 * default is a catalog change (Postgres 11+), no rewrite and no scan. No
 * index: nothing reads turns by it. No `CHECK` tying it to an origin either:
 * adding one validates every row under the lock this boot holds to its end,
 * so that rule is the domain's (`BotTurnEntity`).
 */
export class AddBotTurnContact1795172296524 implements MigrationInterface {
  name = 'AddBotTurnContact1795172296524';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD COLUMN IF NOT EXISTS "contact" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN IF EXISTS "contact"`);
  }
}
