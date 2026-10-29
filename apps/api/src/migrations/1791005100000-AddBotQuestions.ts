import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot can stop on questions for its owner (`ask_user`,
 * `product/versions/mvp/25-bots.md` §3.2; from Grok Bot's form cards,
 * `research/lessons-from-grok-bot.md` §9 row 12).
 *
 * The questions are a Needs input card like an asking call's, so they are a
 * `bot_approval` row: one card per bot (`UQ_bot_approval_pending`), expired
 * by a new message, listed in the Inbox, and reported back by the same turn.
 * The tool and its input hold the questions; what is new is how the card
 * ends, `answered`, and what it was answered with, `answers`, which is set
 * exactly when it was.
 */
export class AddBotQuestions1791005100000 implements MigrationInterface {
  name = 'AddBotQuestions1791005100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bot_approval
        DROP CONSTRAINT "CHK_bot_approval_status",
        ADD COLUMN answers jsonb,
        ADD CONSTRAINT "CHK_bot_approval_status" CHECK ("status" IN ('pending', 'approved', 'denied', 'expired', 'failed', 'answered')),
        ADD CONSTRAINT "CHK_bot_approval_answers" CHECK (("status" = 'answered') = (answers IS NOT NULL))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM bot_approval WHERE "status" = 'answered'`);
    await queryRunner.query(`
      ALTER TABLE bot_approval
        DROP CONSTRAINT "CHK_bot_approval_answers",
        DROP CONSTRAINT "CHK_bot_approval_status",
        DROP COLUMN answers,
        ADD CONSTRAINT "CHK_bot_approval_status" CHECK ("status" IN ('pending', 'approved', 'denied', 'expired', 'failed'))
    `);
  }
}
