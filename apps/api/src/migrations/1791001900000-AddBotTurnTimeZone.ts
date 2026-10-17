import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots: the time zone a turn's message was sent from (`25-bots.md` §2).
 *
 * The console sends the browser's IANA zone with each message, and the turn
 * tells the bot the time there, so "tomorrow at 9" is the sender's 9. It is
 * the turn's, not the account's: there is no stored time zone for a person
 * yet, and a message sent while travelling means the time where they are.
 * Nullable, read as UTC: turns sent before this column, and clients that do
 * not send one. Nothing filters on it, so no index.
 */
export class AddBotTurnTimeZone1791001900000 implements MigrationInterface {
  name = 'AddBotTurnTimeZone1791001900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn ADD COLUMN "timeZone" character varying(64)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "timeZone"`);
  }
}
