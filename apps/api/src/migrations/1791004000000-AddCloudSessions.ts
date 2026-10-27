import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cloud sessions (`product/next-steps/cloud-agents.md`): a session that runs
 * as a vendor's agent in the vendor's cloud, Cursor's first, started from New
 * session on a person's own key for the vendor and listed with every other
 * session.
 *
 * `work_session` gains a third place, `cloud`, and a cloud session has no
 * host: `hostId` becomes nullable, and `CHK_work_session_cloud_host` says the
 * two go together, so a host session can never lose its host and a cloud one
 * can never name one. Everything else about the row holds as it is: the
 * project it is listed under, its slug, its log and the fold of it, which a
 * cloud session's log feeds from what the vendor says about its run rather
 * than from a runner. Its agent is the vendor's (`cursor`), outside the
 * runner's catalog; `agent` has no check, as before.
 *
 * `session_cloud_run` is the vendor's half of a cloud session, one row per
 * session, keyed by it: the vendor's id for the agent (Cursor's `bc-<id>`,
 * the session's own id), its page, the repository it runs on, and what the
 * vendor last said about its latest run, with when. The session's state is
 * the fold; this row is what the next read asks the vendor about, and what
 * the session's row shows beside it (branch, pull request). It goes with its
 * session (`ON DELETE CASCADE` on the workspace-scoped key, as `session_turn`).
 *
 * `cloud_agent_credential` is the person's key for a vendor, one per person,
 * workspace and vendor, sealed with AES-256-GCM under `CLOUD_AGENTS_KEY`
 * (`bytea`), with what the vendor said about it when it was stored (its
 * name, the account's address and id). It goes with the workspace and with
 * the person.
 *
 * Access patterns:
 * - a session's cloud run, read with the session or the list's page of them:
 *   the primary key;
 * - the run behind a vendor's agent id: `UQ_session_cloud_run_external`;
 * - the foreign key to the session: `IDX_session_cloud_run_session`;
 * - a person's key for a vendor: `UQ_cloud_agent_credential_user_provider`,
 *   whose leading column backs the foreign key to the workspace;
 *   `IDX_cloud_agent_credential_user` backs the one to the person.
 *
 * Retention: a run is one small row per cloud session and lives as long as
 * the session's row, which is a tombstone kept for ever.
 *
 * `owner` gains `manage CloudAgent` in its workspace (the person's key and
 * the vendor's lists); the sessions themselves are `Session`'s, as any.
 */
export class AddCloudSessions1791004000000 implements MigrationInterface {
  name = 'AddCloudSessions1791004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE cloud_agent_credential (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        provider character varying(16) NOT NULL,
        "sealedKey" bytea NOT NULL,
        "keyHint" character varying(8) NOT NULL,
        "keyName" character varying(100) NOT NULL,
        "accountEmail" character varying(320),
        "accountId" character varying(64),
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_cloud_agent_credential" PRIMARY KEY (id),
        CONSTRAINT "UQ_cloud_agent_credential_user_provider" UNIQUE ("organizationId", "userId", provider),
        CONSTRAINT "CHK_cloud_agent_credential_provider" CHECK (provider IN ('cursor'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cloud_agent_credential_user" ON cloud_agent_credential USING btree ("userId")`,
    );

    await queryRunner.query(`ALTER TABLE work_session ALTER COLUMN "hostId" DROP NOT NULL`);
    await queryRunner.query('ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_place"');
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_place" CHECK (place IN ('worktree', 'folder', 'cloud'))`,
    );
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_cloud_host" CHECK ((place = 'cloud') = ("hostId" IS NULL))`,
    );

    await queryRunner.query(
      `CREATE TABLE session_cloud_run (
        "sessionId" uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        provider character varying(16) NOT NULL,
        "externalId" character varying(64) NOT NULL,
        url text,
        "repositoryUrl" character varying(500) NOT NULL,
        "latestRunId" character varying(64) NOT NULL,
        status character varying(16) NOT NULL,
        branch character varying(255),
        "pullRequestUrl" text,
        summary text,
        "syncedAt" timestamp with time zone NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_session_cloud_run" PRIMARY KEY ("sessionId"),
        CONSTRAINT "UQ_session_cloud_run_external" UNIQUE (provider, "externalId"),
        CONSTRAINT "CHK_session_cloud_run_provider" CHECK (provider IN ('cursor')),
        CONSTRAINT "CHK_session_cloud_run_status" CHECK (status IN ('starting', 'running', 'finished', 'failed', 'cancelled', 'expired'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_cloud_run_session" ON session_cloud_run USING btree ("organizationId", "sessionId")`,
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
    await queryRunner.query('DROP TABLE session_cloud_run');
    // A cloud session has no host to give it back: its log, turns and row go.
    for (const table of ['work_session_event', 'session_turn']) {
      await queryRunner.query(
        `DELETE FROM ${table} WHERE "sessionId" IN (SELECT id FROM work_session WHERE place = 'cloud')`,
      );
    }
    await queryRunner.query(`DELETE FROM work_session WHERE place = 'cloud'`);
    await queryRunner.query(
      'ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_cloud_host"',
    );
    await queryRunner.query('ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_place"');
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_place" CHECK (place IN ('worktree', 'folder'))`,
    );
    await queryRunner.query(`ALTER TABLE work_session ALTER COLUMN "hostId" SET NOT NULL`);
    await queryRunner.query('DROP TABLE cloud_agent_credential');
  }
}

const OWNER_RULES = [
  {
    action: 'manage',
    subject: 'CloudAgent',
    conditions: { organizationId: '${activeOrganizationId}' },
  },
];

const FOREIGN_KEYS = [
  `ALTER TABLE cloud_agent_credential ADD CONSTRAINT "FK_cloud_agent_credential_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE cloud_agent_credential ADD CONSTRAINT "FK_cloud_agent_credential_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  `ALTER TABLE session_cloud_run ADD CONSTRAINT "FK_session_cloud_run_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE CASCADE`,
];
