import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots no longer get a heartbeat by default, and a heartbeat wakes twice a
 * day rather than every hour (`26-bot-routines.md` §6, "Changed 2026-11-15"):
 * an hourly model turn on every bot with a job, around the clock, was
 * spending the owner's tokens to say nothing.
 *
 * - Every live bot routine named Heartbeat still on the one hourly trigger
 *   it was given has that trigger made daily at 09:00, and a second daily
 *   trigger at 18:00, both in the zone its owner last wrote to the bot from
 *   (their newest message to it that carried one), UTC when they never did.
 *   A heartbeat whose owner changed its triggers keeps them.
 * - Every such routine that is running is paused as its owner would pause
 *   it (`pausedReason = 'user'`, its schedule triggers' `nextFireAt`
 *   cleared, as `AutomationEntity.pause` does), so it wakes again only when
 *   the owner turns it on from the Routines tab; resuming computes its next
 *   slot. Paused ones keep their reason; deleted ones are left alone.
 *
 * No chat line says so: the activity lines are written from domain events,
 * which a migration does not raise, and the owner asked for the change.
 */
export class PauseDefaultBotHeartbeats1794775608906 implements MigrationInterface {
  name = 'PauseDefaultBotHeartbeats1794775608906';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const heartbeats = `SELECT id FROM automation
       WHERE "runTarget" = 'bot' AND name = 'Heartbeat' AND "deletedAt" IS NULL`;
    // The heartbeats on their one default trigger: exactly one schedule trigger, hourly.
    const defaults: { triggerId: string; timezone: string }[] = await queryRunner.query(
      `SELECT trigger.id AS "triggerId",
              COALESCE((SELECT turn."timeZone" FROM bot_turn turn
                         WHERE turn."organizationId" = automation."organizationId"
                           AND turn."botId" = automation."botId"
                           AND turn."requestedByUserId" = automation."ownerUserId"
                           AND turn.origin = 'message' AND turn.lane = 'owner'
                           AND turn."timeZone" IS NOT NULL
                         ORDER BY turn."createdAt" DESC LIMIT 1), 'UTC') AS timezone
         FROM automation_trigger trigger
         JOIN automation ON automation.id = trigger."automationId"
        WHERE automation.id IN (${heartbeats})
          AND trigger.source = 'schedule' AND trigger.config ->> 'frequency' = 'hourly'
          AND (SELECT count(*) FROM automation_trigger other
                WHERE other."automationId" = automation.id) = 1`,
    );
    for (const { triggerId, timezone } of defaults) {
      await queryRunner.query(
        `UPDATE automation_trigger
            SET config = '{"frequency":"daily","hour":9,"minute":0}'::jsonb,
                timezone = $2, "nextFireAt" = NULL, "updatedAt" = now()
          WHERE id = $1`,
        [triggerId, timezone],
      );
      await queryRunner.query(
        `INSERT INTO automation_trigger
           ("organizationId", "automationId", "position", source, "eventType", config, timezone)
         SELECT "organizationId", "automationId", "position" + 1, 'schedule', 'schedule',
                '{"frequency":"daily","hour":18,"minute":0}'::jsonb, $2
           FROM automation_trigger WHERE id = $1`,
        [triggerId, timezone],
      );
    }
    await queryRunner.query(
      `UPDATE automation_trigger SET "nextFireAt" = NULL, "updatedAt" = now()
        WHERE source = 'schedule' AND "automationId" IN (${heartbeats} AND "pausedAt" IS NULL)`,
    );
    await queryRunner.query(
      `UPDATE automation
          SET "pausedAt" = now(), "pausedReason" = 'user',
              "version" = "version" + 1, "updatedAt" = now()
        WHERE id IN (${heartbeats} AND "pausedAt" IS NULL)`,
    );
  }

  public async down(): Promise<void> {
    // Nothing tells a heartbeat this moved or paused from one its owner
    // changed, so each keeps its two times and stays paused until its owner
    // resumes it, which recomputes its next slots.
  }
}
