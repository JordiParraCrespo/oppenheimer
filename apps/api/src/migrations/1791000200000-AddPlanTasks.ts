import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan's board: `goal`, `task` and `task_session`
 * (`product/versions/mvp/19-plan-tasks-and-goals.md` §1), and the owner role's
 * two new subjects, `Task` and `Calendar`.
 *
 * Every key carries the workspace, and every parent reference is composite on
 * it, so no table needs a foreign key of its own to \`organization\`
 * (\`database-design.md\`). A task's goal key is one composite foreign key
 * to the goal's `(organizationId, id, projectId)`: `ON DELETE SET NULL ("goalId")`
 * (Postgres 15+) nulls only the goal when a goal is deleted, and `ON UPDATE
 * CASCADE` carries a goal's move to another project onto its tasks. Tasks and
 * goals go with their project, and links with their task or their session, so
 * erasing a workspace's projects and sessions leaves nothing of Plan behind.
 *
 * The owner role is a global system row seeded from `SYSTEM_ROLE_PERMISSIONS`;
 * the two rules are appended here as that catalog now has them, and the catalog
 * version is bumped so every cached ability is rebuilt (`rbac-roles.md`).
 */
export class AddPlanTasks1791000200000 implements MigrationInterface {
  name = 'AddPlanTasks1791000200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE goal (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        name character varying(200) NOT NULL,
        "targetDate" date,
        "createdByUserId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_goal" PRIMARY KEY (id),
        CONSTRAINT "UQ_goal_organization_id_project" UNIQUE ("organizationId", id, "projectId")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_project" ON goal USING btree ("organizationId", "projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_created_by" ON goal USING btree ("createdByUserId") WHERE ("createdByUserId" IS NOT NULL)`,
    );

    await queryRunner.query(
      `CREATE TABLE task (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "goalId" uuid,
        status character varying(16) NOT NULL,
        rank character varying(128) COLLATE "C" NOT NULL,
        title character varying(500) NOT NULL,
        notes text DEFAULT ''::text NOT NULL,
        "dueDate" date,
        "dueTime" character varying(5),
        "completedAt" timestamp with time zone,
        "createdByUserId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_task" PRIMARY KEY (id),
        CONSTRAINT "UQ_task_organization_id" UNIQUE ("organizationId", id),
        CONSTRAINT "UQ_task_rank" UNIQUE ("organizationId", status, rank),
        CONSTRAINT "CHK_task_status" CHECK (status IN ('later', 'todo', 'doing', 'done')),
        CONSTRAINT "CHK_task_due_time" CHECK ("dueTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
        CONSTRAINT "CHK_task_due_time_has_date" CHECK ("dueTime" IS NULL OR "dueDate" IS NOT NULL)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_project" ON task USING btree ("organizationId", "projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_goal" ON task USING btree ("organizationId", "goalId", "projectId") WHERE ("goalId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_due" ON task USING btree ("organizationId", "dueDate") WHERE ("dueDate" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_created_by" ON task USING btree ("createdByUserId") WHERE ("createdByUserId" IS NOT NULL)`,
    );

    await queryRunner.query(
      `CREATE TABLE task_session (
        "organizationId" uuid NOT NULL,
        "taskId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        origin character varying(16) NOT NULL,
        "linkedByUserId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_task_session" PRIMARY KEY ("organizationId", "taskId", "sessionId"),
        CONSTRAINT "CHK_task_session_origin" CHECK (origin IN ('started', 'linked'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_session_session" ON task_session USING btree ("organizationId", "sessionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_session_linked_by" ON task_session USING btree ("linkedByUserId") WHERE ("linkedByUserId" IS NOT NULL)`,
    );

    for (const statement of FOREIGN_KEYS) await queryRunner.query(statement);

    await queryRunner.query(
      `UPDATE "role" SET permissions = permissions || $1::jsonb
        WHERE name = 'owner' AND "organizationId" IS NULL AND "isSystem"`,
      [JSON.stringify(OWNER_RULES)],
    );
    await queryRunner.query(`UPDATE "role_catalog_version" SET "version" = "version" + 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role" SET permissions = (
         SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
           FROM jsonb_array_elements(permissions) rule
          WHERE NOT (rule->>'subject' = ANY($1))
       )
       WHERE name = 'owner' AND "organizationId" IS NULL AND "isSystem"`,
      [OWNER_RULES.map((rule) => rule.subject)],
    );
    await queryRunner.query(`UPDATE "role_catalog_version" SET "version" = "version" + 1`);
    await queryRunner.query('DROP TABLE task_session');
    await queryRunner.query('DROP TABLE task');
    await queryRunner.query('DROP TABLE goal');
  }
}

const OWNER_RULES = [
  {
    action: 'manage',
    subject: 'Task',
    conditions: { organizationId: '${activeOrganizationId}' },
  },
  {
    action: 'manage',
    subject: 'Calendar',
    conditions: { organizationId: '${activeOrganizationId}' },
  },
];

const FOREIGN_KEYS = [
  `ALTER TABLE goal ADD CONSTRAINT "FK_goal_project" FOREIGN KEY ("organizationId", "projectId") REFERENCES project("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE goal ADD CONSTRAINT "FK_goal_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
  `ALTER TABLE task ADD CONSTRAINT "FK_task_project" FOREIGN KEY ("organizationId", "projectId") REFERENCES project("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE task ADD CONSTRAINT "FK_task_goal" FOREIGN KEY ("organizationId", "goalId", "projectId") REFERENCES goal("organizationId", id, "projectId") ON DELETE SET NULL ("goalId") ON UPDATE CASCADE`,
  `ALTER TABLE task ADD CONSTRAINT "FK_task_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
  `ALTER TABLE task_session ADD CONSTRAINT "FK_task_session_task" FOREIGN KEY ("organizationId", "taskId") REFERENCES task("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE task_session ADD CONSTRAINT "FK_task_session_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE task_session ADD CONSTRAINT "FK_task_session_linked_by" FOREIGN KEY ("linkedByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
];
