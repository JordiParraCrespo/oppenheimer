import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Your reaction to a line of a bot's chat: one emoji on a message of yours or
 * of the bot's, set and taken back from the chat. A workspace has one person,
 * so a message holds one reaction or none, a nullable column read with the
 * message and never searched (no index). The check keeps it to the roles the
 * chat offers it on; the API checks it is one emoji.
 *
 * `down()` drops the column and its check.
 */
export class AddBotMessageReaction1795443646000 implements MigrationInterface {
  name = 'AddBotMessageReaction1795443646000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_message" ADD "reaction" varchar(32)`);
    await queryRunner.query(
      `ALTER TABLE "bot_message" ADD CONSTRAINT "CHK_bot_message_reaction" CHECK ("reaction" IS NULL OR "role" IN ('user', 'assistant'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_message" DROP CONSTRAINT "CHK_bot_message_reaction"`);
    await queryRunner.query(`ALTER TABLE "bot_message" DROP COLUMN "reaction"`);
  }
}
