import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The spend guard on a bot's routines (`26-bot-routines.md` §6): routines
 * that keep running while their owner is away pause, and resume when the
 * owner is back in the bot's chat.
 *
 * - `bot."ownerSeenAt"`: when the owner was last in the bot's chat (opened
 *   it, wrote to it, decided one of its cards). `NOT NULL DEFAULT now()`, so
 *   a new bot is seen at its creation and the bots already here count from
 *   this migration, never as long gone. It is written at most once a minute
 *   (the write is conditional on the old value), and only on what is
 *   already a person's action in the chat, so it adds no hot write to `bot`
 *   beyond the `lastMessageAt` a message already writes.
 * - `automation."pausedReason"` gains `unattended`, the guard's pause, which
 *   the owner's return lifts on its own.
 *
 * No new index: the guard reads a bot's routine turns since `ownerSeenAt`
 * through `IDX_bot_turn_bot` ("organizationId", "botId", "createdAt", "id")
 * and their messages through `IDX_bot_message_turn`; the routines to pause
 * or resume through `IDX_automation_bot`. A run's skip reason is a
 * `varchar(40)` with no list, so `unattended` needs no change there.
 */
export class AddRoutineSpendGuard1794045167486 implements MigrationInterface {
  name = 'AddRoutineSpendGuard1794045167486';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bot ADD COLUMN "ownerSeenAt" timestamptz NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_paused_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_paused_reason" CHECK ("pausedReason" IN ('user', 'project_archived', 'host_unpaired', 'owner_lost_access', 'bot_provider_missing', 'cloud_key_missing', 'unattended'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The reason goes; the pause stays, as one the owner resumes.
    await queryRunner.query(
      `UPDATE automation SET "pausedReason" = 'user' WHERE "pausedReason" = 'unattended'`,
    );
    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_paused_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_paused_reason" CHECK ("pausedReason" IN ('user', 'project_archived', 'host_unpaired', 'owner_lost_access', 'bot_provider_missing', 'cloud_key_missing'))`,
    );
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "ownerSeenAt"`);
  }
}
