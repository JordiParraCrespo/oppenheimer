import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The spend guard on a bot's routines is gone (`26-bot-routines.md` §6,
 * "Removed 2026-11-10"): routines run on their schedule whether or not their
 * owner reads them, as OpenClaw's heartbeat does. The run budget and the
 * overlap guard still hold the cost.
 *
 * - Every live routine paused as `unattended` resumes. The entity's resume
 *   recomputes each schedule trigger's next slot; SQL cannot, so their
 *   `nextFireAt` is set to now and the scheduler's next tick fires each once
 *   and computes the next slot from there, as it does after any firing.
 *   That one run is what the owner's return would have started anyway.
 * - `automation."pausedReason"` loses `unattended`.
 * - `bot."ownerSeenAt"`, `bot."routineSpendGuard"`,
 *   `automation_settings."unattendedReports"` and `"unattendedAwaySeconds"`
 *   (with `CHK_automation_settings_unattended`) are dropped: nothing reads them.
 *
 * Runs skipped as `unattended` keep that reason: a run's skip reason is a
 * `varchar(40)` with no list, and the history says what happened.
 */
export class RemoveRoutineSpendGuard1794324212590 implements MigrationInterface {
  name = 'RemoveRoutineSpendGuard1794324212590';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE automation_trigger SET "nextFireAt" = now(), "updatedAt" = now()
        WHERE source = 'schedule' AND "automationId" IN (
          SELECT id FROM automation WHERE "pausedReason" = 'unattended' AND "deletedAt" IS NULL)`,
    );
    await queryRunner.query(
      `UPDATE automation SET "pausedAt" = NULL, "pausedReason" = NULL, "updatedAt" = now()
        WHERE "pausedReason" = 'unattended' AND "deletedAt" IS NULL`,
    );
    // A deleted routine keeps its tombstone; its reason becomes the owner's.
    await queryRunner.query(
      `UPDATE automation SET "pausedReason" = 'user' WHERE "pausedReason" = 'unattended'`,
    );
    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_paused_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_paused_reason" CHECK ("pausedReason" IN ('user', 'project_archived', 'host_unpaired', 'owner_lost_access', 'bot_provider_missing', 'cloud_key_missing'))`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_settings DROP CONSTRAINT "CHK_automation_settings_unattended"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_settings DROP COLUMN "unattendedAwaySeconds", DROP COLUMN "unattendedReports"`,
    );
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "routineSpendGuard"`);
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "ownerSeenAt"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The columns come back at their defaults; the routines it resumed stay running.
    await queryRunner.query(
      `ALTER TABLE bot ADD COLUMN "ownerSeenAt" timestamptz NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE bot ADD COLUMN "routineSpendGuard" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_settings ADD COLUMN "unattendedReports" integer, ADD COLUMN "unattendedAwaySeconds" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_settings ADD CONSTRAINT "CHK_automation_settings_unattended" CHECK ((COALESCE("unattendedReports", 1) >= 1) AND (COALESCE("unattendedAwaySeconds", 3600) >= 3600))`,
    );
    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_paused_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_paused_reason" CHECK ("pausedReason" IN ('user', 'project_archived', 'host_unpaired', 'owner_lost_access', 'bot_provider_missing', 'cloud_key_missing', 'unattended'))`,
    );
  }
}
