import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Automations that run in the cloud (`product/next-steps/cloud-agents.md`,
 * "Tasks and automations"): a session automation's run starts its session on
 * the host, as before, in Claude Code's cloud from that host, or at a vendor
 * the control plane launches on the owner's key, with no host.
 *
 * - `automation_revision."place"`: where a run's session runs, one of
 *   `host`, `claude-cloud` and `cursor` (a vendor's place is its provider's
 *   id). It is part of what a run executes, so it lives on the revision
 *   beside the host and the agent, and changing it is the next revision.
 *   `NOT NULL DEFAULT 'host'`, so every revision before this one runs where it
 *   always did; a bot routine's revision keeps the default and never reads it.
 * - `CHK_automation_revision_place_host` replaces
 *   `CHK_automation_revision_session` ("a host exactly when an agent"): a
 *   revision names no host when it is a routine's (`agent IS NULL`) or a
 *   vendor's, and names one otherwise.
 * - `automation."pausedReason"` gains `cloud_key_missing`: an automation whose
 *   owner has no key for its vendor, or whose key the vendor refused, is
 *   paused rather than failed every hour, until the owner adds one and
 *   resumes it.
 *
 * No new index: a run reads its revision by id, and nothing lists revisions
 * by place. `IDX_automation_revision_host` still serves the host's runs; a
 * vendor's revisions are its `NULL`s, which no query asks for by host.
 */
export class AddAutomationPlaces1791004300000 implements MigrationInterface {
  name = 'AddAutomationPlaces1791004300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE automation_revision ADD COLUMN "place" character varying(16) NOT NULL DEFAULT 'host'`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision ADD CONSTRAINT "CHK_automation_revision_place" CHECK ("place" IN ('host', 'claude-cloud', 'cursor'))`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision DROP CONSTRAINT "CHK_automation_revision_session"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision ADD CONSTRAINT "CHK_automation_revision_place_host" CHECK (("hostId" IS NULL) = ("agent" IS NULL OR "place" = 'cursor'))`,
    );

    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_paused_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_paused_reason" CHECK ("pausedReason" IN ('user', 'project_archived', 'host_unpaired', 'owner_lost_access', 'bot_provider_missing', 'cloud_key_missing'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The reason goes; the pause stays, as one the owner resumes.
    await queryRunner.query(
      `UPDATE automation SET "pausedReason" = 'user' WHERE "pausedReason" = 'cloud_key_missing'`,
    );
    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_paused_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_paused_reason" CHECK ("pausedReason" IN ('user', 'project_archived', 'host_unpaired', 'owner_lost_access', 'bot_provider_missing'))`,
    );

    // An automation with a revision at a vendor has no host to fall back to,
    // so it goes, its revisions, triggers and runs with it (they cascade).
    await queryRunner.query(
      `DELETE FROM automation WHERE id IN (SELECT "automationId" FROM automation_revision WHERE "place" = 'cursor')`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision DROP CONSTRAINT "CHK_automation_revision_place_host"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision ADD CONSTRAINT "CHK_automation_revision_session" CHECK (("hostId" IS NULL) = (agent IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision DROP CONSTRAINT "CHK_automation_revision_place"`,
    );
    await queryRunner.query(`ALTER TABLE automation_revision DROP COLUMN "place"`);
  }
}
