import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Automations: a saved prompt, the triggers that start it, and why each run
 * happened (`product/versions/mvp/16-automations-architecture.md`).
 *
 * Five tables, each one fact:
 *
 * - **`automation`** is identity and state: the workspace, the owner a run acts
 *   as, the project it is listed under, its name, whether and why it is paused,
 *   the per-automation limits (null inherits the workspace's) and `version` for
 *   two tabs saving at once. Deleting one is a tombstone (`deletedAt`): its runs
 *   are kept and read "Deleted automation".
 * - **`automation_revision`** is what a run executes — prompt, agent, model,
 *   permission, effort, host, repositories — immutable and numbered. A save that
 *   changes any of them inserts the next revision; renames, pauses and trigger
 *   edits make none. Every run records the revision it ran, so editing the
 *   prompt never rewrites last week's history. `automation."currentRevisionId"`
 *   is a deferred foreign key because the pair is inserted in one transaction.
 * - **`automation_trigger`** is one trigger: `source`, `eventType` and a
 *   `config` validated by the trigger catalog's schema on every write, plus the
 *   two columns the scheduler claims by (`timezone`, `nextFireAt`). A new source
 *   is catalog rows, not a migration.
 * - **`automation_trigger_subject`** is what a trigger watches (a GitHub
 *   repository today, a Slack channel later), so the matcher asks "which
 *   triggers watch this repository" through an index rather than scanning json.
 * - **`automation_run`** is one firing: which automation, revision and trigger,
 *   the cause (schedule slot, event, Run now) and a snapshot of it that outlives
 *   the event's 30-day retention, what the guards decided, and the session it
 *   dispatched. **It holds no execution state**: how the run went is the
 *   session's turn (`session_turn`), joined on read.
 * - **`automation_settings`** is the workspace's level of the three-level
 *   configuration (platform ceiling ∩ workspace ∩ automation). One row per
 *   workspace, every column nullable: null is the platform default.
 *
 * Access patterns:
 *
 *   Q1  the workspace's automations for the sidebar and table
 *                                   → IDX_automation_project
 *   Q2  due schedule triggers, every minute, across workspaces
 *                                   → IDX_automation_trigger_due (partial on nextFireAt)
 *   Q3  triggers watching a subject for an event type
 *                                   → IDX_automation_trigger_subject_lookup + IDX_automation_trigger_match
 *   Q4  the runs list and history chart, newest first, by workspace
 *                                   → IDX_automation_run_organization_created
 *   Q5  one automation's runs, and its hourly rate count
 *                                   → IDX_automation_run_automation_created
 *   Q6  a firing once per cause     → UQ_automation_run_automation_cause
 *   Q7  pending runs past their TTL → IDX_automation_run_pending
 *   Q8  the run a session belongs to → UQ_automation_run_session
 *
 * **`automation_revision."hostId"` has no foreign key, on purpose.** A host is
 * a person's and is only ever deleted with their account, while a revision is
 * history other people's automations may hold; a key would either block that
 * erasure or cascade away revisions a live automation points at. Whether the
 * host is still usable is decided at dispatch, as the owner, every time — the
 * same check a person's session gets.
 *
 * Retention: runs are kept 180 days (the chart shows 30, the list filters to
 * 30), purged nightly in batches through IDX_automation_run_organization_created.
 * Everything else lives as long as its automation.
 */
export class AddAutomations1790600000000 implements MigrationInterface {
  name = 'AddAutomations1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "automation" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "ownerUserId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "currentRevisionId" uuid NOT NULL,
        "pausedAt" timestamptz,
        "pausedReason" varchar(32),
        "deletedAt" timestamptz,
        "overlap" varchar(8),
        "maxRunsPerHour" integer,
        "version" integer NOT NULL DEFAULT 1,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_automation" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_automation_organization_id" UNIQUE ("organizationId", "id"),
        CONSTRAINT "FK_automation_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_automation_project"
          FOREIGN KEY ("organizationId", "projectId")
          REFERENCES "project" ("organizationId", "id") ON DELETE CASCADE,
        CONSTRAINT "FK_automation_owner"
          FOREIGN KEY ("ownerUserId") REFERENCES "user" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_automation_name" CHECK (char_length("name") > 0),
        CONSTRAINT "CHK_automation_paused"
          CHECK (("pausedAt" IS NULL) = ("pausedReason" IS NULL)),
        CONSTRAINT "CHK_automation_paused_reason" CHECK ("pausedReason" IN
          ('user', 'project_archived', 'host_unpaired', 'owner_lost_access')),
        CONSTRAINT "CHK_automation_overlap" CHECK ("overlap" IN ('skip', 'queue')),
        CONSTRAINT "CHK_automation_max_runs" CHECK ("maxRunsPerHour" >= 1),
        CONSTRAINT "CHK_automation_version" CHECK ("version" >= 1)
      )`,
    );
    // Q1, and the composite key to project: a project erased with its
    // workspace must not scan automations.
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_project" ON "automation" ("organizationId", "projectId")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_automation_owner" ON "automation" ("ownerUserId")`);

    await queryRunner.query(
      `CREATE TABLE "automation_revision" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "automationId" uuid NOT NULL,
        "number" integer NOT NULL,
        "hostId" uuid NOT NULL,
        "agent" varchar(32) NOT NULL,
        "model" varchar(128),
        "permission" varchar(8) NOT NULL DEFAULT 'auto',
        "effort" varchar(16),
        "prompt" text NOT NULL,
        "repositories" jsonb NOT NULL,
        "createdByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_automation_revision" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_automation_revision_automation_number" UNIQUE ("automationId", "number"),
        CONSTRAINT "UQ_automation_revision_organization_id" UNIQUE ("organizationId", "id"),
        CONSTRAINT "FK_automation_revision_automation"
          FOREIGN KEY ("organizationId", "automationId")
          REFERENCES "automation" ("organizationId", "id") ON DELETE CASCADE,
        CONSTRAINT "FK_automation_revision_created_by"
          FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_automation_revision_number" CHECK ("number" >= 1),
        CONSTRAINT "CHK_automation_revision_permission" CHECK ("permission" IN ('auto', 'full')),
        CONSTRAINT "CHK_automation_revision_prompt" CHECK (char_length("prompt") > 0),
        CONSTRAINT "CHK_automation_revision_repositories"
          CHECK (jsonb_typeof("repositories") = 'array' AND jsonb_array_length("repositories") >= 1)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_revision_automation"
         ON "automation_revision" ("organizationId", "automationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_revision_created_by"
         ON "automation_revision" ("createdByUserId") WHERE "createdByUserId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_revision_host" ON "automation_revision" ("hostId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "automation" ADD CONSTRAINT "FK_automation_current_revision"
         FOREIGN KEY ("currentRevisionId") REFERENCES "automation_revision" ("id")
         DEFERRABLE INITIALLY DEFERRED`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_current_revision" ON "automation" ("currentRevisionId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "automation_trigger" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "automationId" uuid NOT NULL,
        "position" smallint NOT NULL DEFAULT 0,
        "source" varchar(32) NOT NULL,
        "eventType" varchar(64) NOT NULL,
        "config" jsonb NOT NULL,
        "timezone" varchar(64),
        "nextFireAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_automation_trigger" PRIMARY KEY ("id"),
        CONSTRAINT "FK_automation_trigger_automation"
          FOREIGN KEY ("organizationId", "automationId")
          REFERENCES "automation" ("organizationId", "id") ON DELETE CASCADE,
        CONSTRAINT "CHK_automation_trigger_source" CHECK ("source" IN ('schedule', 'github')),
        CONSTRAINT "CHK_automation_trigger_config" CHECK (jsonb_typeof("config") = 'object'),
        CONSTRAINT "CHK_automation_trigger_schedule"
          CHECK (("source" = 'schedule') = ("timezone" IS NOT NULL)),
        CONSTRAINT "CHK_automation_trigger_next_fire"
          CHECK ("source" = 'schedule' OR "nextFireAt" IS NULL),
        CONSTRAINT "CHK_automation_trigger_position" CHECK ("position" >= 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_trigger_automation"
         ON "automation_trigger" ("organizationId", "automationId", "position")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_trigger_match"
         ON "automation_trigger" ("organizationId", "source", "eventType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_trigger_due"
         ON "automation_trigger" ("nextFireAt") WHERE "nextFireAt" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "automation_trigger_subject" (
        "triggerId" uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "subjectKind" varchar(32) NOT NULL,
        "subjectRef" varchar(128) NOT NULL,
        CONSTRAINT "PK_automation_trigger_subject"
          PRIMARY KEY ("triggerId", "subjectKind", "subjectRef"),
        CONSTRAINT "FK_automation_trigger_subject_trigger"
          FOREIGN KEY ("triggerId") REFERENCES "automation_trigger" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_automation_trigger_subject_kind" CHECK ("subjectKind" IN ('repository'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_trigger_subject_lookup"
         ON "automation_trigger_subject" ("organizationId", "subjectKind", "subjectRef")`,
    );

    await queryRunner.query(
      `CREATE TABLE "automation_run" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "automationId" uuid NOT NULL,
        "revisionId" uuid NOT NULL,
        "triggerId" uuid,
        "cause" varchar(16) NOT NULL,
        "causeKey" varchar(200) NOT NULL,
        "causeSummary" jsonb NOT NULL DEFAULT '{}',
        "inboundEventId" uuid,
        "scheduledFor" timestamptz,
        "outcome" varchar(16) NOT NULL DEFAULT 'pending',
        "skipReason" varchar(40),
        "availableAt" timestamptz NOT NULL DEFAULT now(),
        "attempts" integer NOT NULL DEFAULT 0,
        "sessionId" uuid,
        "requestedByUserId" uuid,
        "dispatchedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_automation_run" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_automation_run_automation_cause" UNIQUE ("automationId", "causeKey"),
        CONSTRAINT "FK_automation_run_automation"
          FOREIGN KEY ("organizationId", "automationId")
          REFERENCES "automation" ("organizationId", "id") ON DELETE CASCADE,
        CONSTRAINT "FK_automation_run_revision"
          FOREIGN KEY ("organizationId", "revisionId")
          REFERENCES "automation_revision" ("organizationId", "id") ON DELETE CASCADE,
        CONSTRAINT "FK_automation_run_trigger"
          FOREIGN KEY ("triggerId") REFERENCES "automation_trigger" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_automation_run_inbound_event"
          FOREIGN KEY ("inboundEventId") REFERENCES "inbound_event" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_automation_run_session"
          FOREIGN KEY ("organizationId", "sessionId")
          REFERENCES "work_session" ("organizationId", "id") ON DELETE SET NULL ("sessionId"),
        CONSTRAINT "FK_automation_run_requested_by"
          FOREIGN KEY ("requestedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_automation_run_cause" CHECK ("cause" IN ('schedule', 'event', 'manual')),
        CONSTRAINT "CHK_automation_run_cause_summary" CHECK (jsonb_typeof("causeSummary") = 'object'),
        CONSTRAINT "CHK_automation_run_outcome"
          CHECK ("outcome" IN ('pending', 'skipped', 'expired', 'dispatched')),
        CONSTRAINT "CHK_automation_run_skip_reason"
          CHECK (("outcome" = 'skipped') = ("skipReason" IS NOT NULL)),
        CONSTRAINT "CHK_automation_run_dispatched"
          CHECK (("outcome" = 'dispatched') = ("dispatchedAt" IS NOT NULL)),
        CONSTRAINT "CHK_automation_run_attempts" CHECK ("attempts" >= 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_run_organization_created"
         ON "automation_run" ("organizationId", "createdAt", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_run_automation_created"
         ON "automation_run" ("organizationId", "automationId", "createdAt", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_run_revision" ON "automation_run" ("organizationId", "revisionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_run_trigger"
         ON "automation_run" ("triggerId") WHERE "triggerId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_run_inbound_event"
         ON "automation_run" ("inboundEventId") WHERE "inboundEventId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_automation_run_session"
         ON "automation_run" ("sessionId") WHERE "sessionId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_run_organization_session"
         ON "automation_run" ("organizationId", "sessionId") WHERE "sessionId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_run_requested_by"
         ON "automation_run" ("requestedByUserId") WHERE "requestedByUserId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_run_pending"
         ON "automation_run" ("availableAt") WHERE "outcome" = 'pending'`,
    );

    await queryRunner.query(
      `CREATE TABLE "automation_settings" (
        "organizationId" uuid NOT NULL,
        "maxRunsPerAutomationHour" integer,
        "maxRunsPerWorkspaceHour" integer,
        "headlessRunsPerHost" integer,
        "overlap" varchar(8),
        "staleTtlSeconds" integer,
        "missedGraceSeconds" integer,
        "maxRunSeconds" integer,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_automation_settings" PRIMARY KEY ("organizationId"),
        CONSTRAINT "FK_automation_settings_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_automation_settings_positive" CHECK (
          coalesce("maxRunsPerAutomationHour", 1) >= 1 AND coalesce("maxRunsPerWorkspaceHour", 1) >= 1
          AND coalesce("headlessRunsPerHost", 1) >= 1 AND coalesce("staleTtlSeconds", 60) >= 60
          AND coalesce("missedGraceSeconds", 0) >= 0 AND coalesce("maxRunSeconds", 60) >= 60),
        CONSTRAINT "CHK_automation_settings_overlap" CHECK ("overlap" IN ('skip', 'queue'))
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "automation_settings"`);
    await queryRunner.query(`DROP TABLE "automation_run"`);
    await queryRunner.query(`DROP TABLE "automation_trigger_subject"`);
    await queryRunner.query(`DROP TABLE "automation_trigger"`);
    await queryRunner.query(
      `ALTER TABLE "automation" DROP CONSTRAINT "FK_automation_current_revision"`,
    );
    await queryRunner.query(`DROP TABLE "automation_revision"`);
    await queryRunner.query(`DROP TABLE "automation"`);
  }
}
