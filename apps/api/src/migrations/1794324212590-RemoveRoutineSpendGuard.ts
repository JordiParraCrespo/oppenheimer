import { nextScheduleOccurrence, type ScheduleRule } from '@oppenheimer/shared/automations';
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The spend guard on a bot's routines is gone (`26-bot-routines.md` §6,
 * "Removed 2026-11-10"): routines run on their schedule whether or not their
 * owner reads them, as OpenClaw's heartbeat does. The run budget and the
 * overlap guard still hold the cost.
 *
 * - Every live routine paused as `unattended` resumes, as the owner's return
 *   resumed it: each schedule trigger's `nextFireAt` is its next slot after
 *   now, from the scheduler's own rule (`nextScheduleOccurrence`, what
 *   `AutomationEntity.resume` computes through `nextFireOf`), so nothing
 *   fires at deploy time and a `once` already past stays without a slot.
 *   SQL cannot compute a slot, hence the one read and a write per trigger;
 *   a fresh database has no such row, so the shared rule changing later
 *   cannot change what this did.
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
    const now = new Date();
    const triggers: { id: string; config: Omit<ScheduleRule, 'timezone'>; timezone: string }[] =
      await queryRunner.query(
        `SELECT trigger.id, trigger.config, trigger.timezone FROM automation_trigger trigger
           JOIN automation ON automation.id = trigger."automationId"
          WHERE trigger.source = 'schedule' AND automation."pausedReason" = 'unattended'
            AND automation."deletedAt" IS NULL`,
      );
    for (const trigger of triggers) {
      const next = nextScheduleOccurrence({ ...trigger.config, timezone: trigger.timezone }, now);
      await queryRunner.query(
        `UPDATE automation_trigger SET "nextFireAt" = $2, "updatedAt" = now() WHERE id = $1`,
        [trigger.id, next],
      );
    }
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
