import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan's second cut (`product/versions/mvp/23-plan-milestones-stats-accounts.md`
 * §3, §4 and §7): what a task and a milestone need for agents to work beside
 * people, and the log Stats counts from.
 *
 * - `task.version` and `milestone.version` go up on every write. A writer that
 *   names the version it read writes `… WHERE version = $n` and is refused when
 *   someone wrote first; a writer that names none still bumps it.
 * - `task.blockedReason` and `blockedAt` are set and cleared together (a
 *   `CHECK`): a person or an agent marks a task blocked and says why.
 * - `idempotencyKey` on both, unique per workspace among the rows that have
 *   one, so a retried create makes one row. Nothing expires the keys: they
 *   live as long as the row.
 * - `plan_event` is append-only: one row per change worth logging, of a task
 *   or a milestone, with who made it. Its subject has no foreign key on
 *   purpose: the row outlives a deleted task, so last month's completions do
 *   not shrink. It does have one to `organization`, `ON DELETE CASCADE`,
 *   because nothing else reaches it: erasing an account deletes its personal
 *   workspace, and the events go with it. `actorAgentId` names an agent of the
 *   agents module, which has no table yet; the application owns it. Retention:
 *   kept, a few rows per task; a partitioning candidate only if a workspace
 *   reaches millions.
 *
 * Indexes serve: Stats' range reads, `("organizationId", "occurredAt")` for
 * the workspace and `("organizationId", "projectId", "occurredAt")` for one
 * project (the first also backs the organization key); `actorUserId`'s key.
 *
 * The backfill writes one `created` per task and milestone at its
 * `createdAt`, and one `completed` per Done task at its `completedAt`, so
 * Stats has a past from the first day.
 */
export class AddPlanEvents1791001000000 implements MigrationInterface {
  name = 'AddPlanEvents1791001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE task
         ADD COLUMN version integer NOT NULL DEFAULT 1,
         ADD COLUMN "blockedReason" character varying(500),
         ADD COLUMN "blockedAt" timestamp with time zone,
         ADD COLUMN "idempotencyKey" character varying(128),
         ADD CONSTRAINT "CHK_task_version" CHECK (version >= 1),
         ADD CONSTRAINT "CHK_task_blocked" CHECK (("blockedReason" IS NULL) = ("blockedAt" IS NULL))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_idempotency_key" ON task ("organizationId", "idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE milestone
         ADD COLUMN version integer NOT NULL DEFAULT 1,
         ADD COLUMN "idempotencyKey" character varying(128),
         ADD CONSTRAINT "CHK_milestone_version" CHECK (version >= 1)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_milestone_idempotency_key" ON milestone ("organizationId", "idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL)`,
    );

    await queryRunner.query(
      `CREATE TABLE plan_event (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "subjectType" character varying(16) NOT NULL,
        "subjectId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "milestoneId" uuid,
        kind character varying(24) NOT NULL,
        "actorType" character varying(8) NOT NULL,
        "actorUserId" uuid,
        "actorAgentId" uuid,
        payload jsonb DEFAULT '{}'::jsonb NOT NULL,
        "occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_plan_event" PRIMARY KEY (id),
        CONSTRAINT "CHK_plan_event_subject_type" CHECK ("subjectType" IN ('task', 'milestone')),
        CONSTRAINT "CHK_plan_event_kind" CHECK (kind IN (${KINDS})),
        CONSTRAINT "CHK_plan_event_kind_subject" CHECK ((kind LIKE 'milestone\\_%') = ("subjectType" = 'milestone')),
        CONSTRAINT "CHK_plan_event_actor_type" CHECK ("actorType" IN ('user', 'agent')),
        CONSTRAINT "CHK_plan_event_agent" CHECK (("actorType" = 'agent') = ("actorAgentId" IS NOT NULL))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_event_occurred" ON plan_event USING btree ("organizationId", "occurredAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_event_project_occurred" ON plan_event USING btree ("organizationId", "projectId", "occurredAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_event_actor_user" ON plan_event USING btree ("actorUserId") WHERE ("actorUserId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE plan_event ADD CONSTRAINT "FK_plan_event_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE plan_event ADD CONSTRAINT "FK_plan_event_actor_user" FOREIGN KEY ("actorUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `INSERT INTO plan_event ("organizationId", "subjectType", "subjectId", "projectId", "milestoneId", kind, "actorType", "actorUserId", "occurredAt")
       SELECT "organizationId", 'task', id, "projectId", "milestoneId", 'created', 'user', "createdByUserId", "createdAt" FROM task
       UNION ALL
       SELECT "organizationId", 'task', id, "projectId", "milestoneId", 'completed', 'user', "createdByUserId", "completedAt"
         FROM task WHERE status = 'done' AND "completedAt" IS NOT NULL
       UNION ALL
       SELECT "organizationId", 'milestone', id, "projectId", id, 'milestone_created', 'user', "createdByUserId", "createdAt" FROM milestone`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE plan_event');
    await queryRunner.query('DROP INDEX "UQ_milestone_idempotency_key"');
    await queryRunner.query(
      `ALTER TABLE milestone DROP CONSTRAINT "CHK_milestone_version", DROP COLUMN "idempotencyKey", DROP COLUMN version`,
    );
    await queryRunner.query('DROP INDEX "UQ_task_idempotency_key"');
    await queryRunner.query(
      `ALTER TABLE task
         DROP CONSTRAINT "CHK_task_blocked",
         DROP CONSTRAINT "CHK_task_version",
         DROP COLUMN "idempotencyKey",
         DROP COLUMN "blockedAt",
         DROP COLUMN "blockedReason",
         DROP COLUMN version`,
    );
  }
}

/** `PLAN_TASK_EVENT_KINDS` and `PLAN_MILESTONE_EVENT_KINDS` as they stood when this ran. */
const KINDS = [
  'created',
  'deleted',
  'completed',
  'reopened',
  'status_changed',
  'rescheduled',
  'reassigned',
  'blocked',
  'unblocked',
  'session_linked',
  'milestone_created',
  'milestone_deleted',
  'milestone_renamed',
  'milestone_retargeted',
  'milestone_moved',
]
  .map((kind) => `'${kind}'`)
  .join(', ');
