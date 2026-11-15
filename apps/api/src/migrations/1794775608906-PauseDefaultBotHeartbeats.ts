import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots no longer get a heartbeat by default (`26-bot-routines.md` §6,
 * "Changed 2026-11-15"): an hourly model turn on every bot with a job,
 * around the clock, was spending the owner's tokens to say nothing. Every
 * live bot routine named Heartbeat that is running is paused here as its
 * owner would pause it (`pausedReason = 'user'`, its schedule triggers'
 * `nextFireAt` cleared, as `AutomationEntity.pause` does), so the owner
 * turns it back on from the Routines tab when they want one. Paused ones
 * keep their reason; deleted ones are left alone.
 *
 * No chat line says so: the activity lines are written from domain events,
 * which a migration does not raise, and the owner asked for the change.
 */
export class PauseDefaultBotHeartbeats1794775608906 implements MigrationInterface {
  name = 'PauseDefaultBotHeartbeats1794775608906';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE automation_trigger SET "nextFireAt" = NULL, "updatedAt" = now()
        WHERE source = 'schedule' AND "automationId" IN (
          SELECT id FROM automation
           WHERE "runTarget" = 'bot' AND name = 'Heartbeat'
             AND "pausedAt" IS NULL AND "deletedAt" IS NULL)`,
    );
    await queryRunner.query(
      `UPDATE automation
          SET "pausedAt" = now(), "pausedReason" = 'user',
              "version" = "version" + 1, "updatedAt" = now()
        WHERE "runTarget" = 'bot' AND name = 'Heartbeat'
          AND "pausedAt" IS NULL AND "deletedAt" IS NULL`,
    );
  }

  public async down(): Promise<void> {
    // Nothing tells a heartbeat this paused from one its owner paused, so
    // each stays paused until its owner resumes it, which recomputes its slot.
  }
}
