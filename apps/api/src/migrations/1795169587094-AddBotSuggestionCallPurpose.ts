import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot's call spend gets one more purpose, `suggestion`: the composer's
 * guess at the person's next message, asked of the bot's own model after a
 * turn ends. Only the check changes; no row is rewritten.
 */
export class AddBotSuggestionCallPurpose1795169587094 implements MigrationInterface {
  name = 'AddBotSuggestionCallPurpose1795169587094';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bot_model_call DROP CONSTRAINT "CHK_bot_model_call_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call ADD CONSTRAINT "CHK_bot_model_call_purpose" CHECK (purpose IN ('goal_review', 'summary', 'rule_review', 'dream', 'suggestion'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM bot_model_call WHERE purpose = 'suggestion'`);
    await queryRunner.query(
      `ALTER TABLE bot_model_call DROP CONSTRAINT "CHK_bot_model_call_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call ADD CONSTRAINT "CHK_bot_model_call_purpose" CHECK (purpose IN ('goal_review', 'summary', 'rule_review', 'dream'))`,
    );
  }
}
