import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A contact's turn: a turn a bot runs for someone who is not its owner, a
 * person or a group a WhatsApp number allows
 * (`product/design/channels/answering-on-telegram-and-whatsapp.md` §3). It is
 * queued on the owner's account, as every turn is, so `bot_turn."contact"`
 * is what tells the turn to run without the owner's tools or memory, and
 * which kind of chat it answers: `direct` (one person) or `group`; null for
 * every turn that is no contact's.
 *
 * Lock-safe on a table with rows: a nullable column with no default is a
 * catalog change, no rewrite and no scan. No index: nothing reads turns by
 * it. No `CHECK` on its values or tying it to an origin either: adding one
 * validates every row under the lock this boot holds to its end, so those
 * rules are the domain's (`BotTurnEntity`).
 */
export class AddBotTurnContact1795172296524 implements MigrationInterface {
  name = 'AddBotTurnContact1795172296524';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn ADD COLUMN IF NOT EXISTS "contact" varchar(8)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN IF EXISTS "contact"`);
  }
}
