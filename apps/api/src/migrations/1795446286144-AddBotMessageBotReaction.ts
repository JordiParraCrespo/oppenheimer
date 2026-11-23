import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The bot's reaction to a message of yours: one emoji its `react` tool sets,
 * beside yours (`reaction`), as two people each react to a message. Only a
 * message of yours takes one; a nullable column read with the message, never
 * searched (no index). The API checks it is one emoji.
 *
 * `down()` drops the column and its check.
 */
export class AddBotMessageBotReaction1795446286144 implements MigrationInterface {
  name = 'AddBotMessageBotReaction1795446286144';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_message" ADD "botReaction" varchar(32)`);
    await queryRunner.query(
      `ALTER TABLE "bot_message" ADD CONSTRAINT "CHK_bot_message_bot_reaction" CHECK ("botReaction" IS NULL OR "role" = 'user')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bot_message" DROP CONSTRAINT "CHK_bot_message_bot_reaction"`,
    );
    await queryRunner.query(`ALTER TABLE "bot_message" DROP COLUMN "botReaction"`);
  }
}
