import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Routine activity in a bot's chat (`product/versions/mvp/26-bot-routines.md`
 * §4, "In the chat"), the second half of slice C.
 *
 * - `bot_message."turnId"` nullable: a routine saved, changed, paused,
 *   resumed, deleted or failed is a line in the chat at the moment it
 *   happened, and most of those moments belong to no turn (the Routines
 *   tab, a pause the dispatcher made, a run that never reached its turn).
 *   Only an event may stand outside a turn (`CHK_bot_message_turn`); what
 *   you said and what the bot answered always belong to one. The
 *   composite foreign key to `bot_turn` is `MATCH SIMPLE`, so a null
 *   `"turnId"` is not checked against it and clearing a turn's messages
 *   leaves these alone.
 * - `automation."pausedReason"` gains `bot_provider_missing`: a routine
 *   whose bot's provider has no credential is paused, not failed every
 *   hour, until the owner adds one and resumes it.
 *
 * No new index: a turnless line is read with the rest of the chat, by
 * `IDX_bot_message_bot`.
 */
export class AddRoutineActivityLines1791003100000 implements MigrationInterface {
  name = 'AddRoutineActivityLines1791003100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_message ALTER COLUMN "turnId" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE bot_message ADD CONSTRAINT "CHK_bot_message_turn" CHECK ("turnId" IS NOT NULL OR "role" = 'event')`,
    );

    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_paused_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_paused_reason" CHECK ("pausedReason" IN ('user', 'project_archived', 'host_unpaired', 'owner_lost_access', 'bot_provider_missing'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The reason goes; the pause stays, as one the owner resumes.
    await queryRunner.query(
      `UPDATE automation SET "pausedReason" = 'user' WHERE "pausedReason" = 'bot_provider_missing'`,
    );
    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_paused_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_paused_reason" CHECK ("pausedReason" IN ('user', 'project_archived', 'host_unpaired', 'owner_lost_access'))`,
    );

    // Lines outside a turn have nowhere to go.
    await queryRunner.query(`DELETE FROM bot_message WHERE "turnId" IS NULL`);
    await queryRunner.query(`ALTER TABLE bot_message DROP CONSTRAINT "CHK_bot_message_turn"`);
    await queryRunner.query(`ALTER TABLE bot_message ALTER COLUMN "turnId" SET NOT NULL`);
  }
}
