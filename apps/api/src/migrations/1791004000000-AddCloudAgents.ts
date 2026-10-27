import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cloud agents (`product/next-steps/cloud-agents.md`): coding agents run in a
 * vendor's cloud, Cursor's first, launched from the console on a person's own
 * key for the vendor.
 *
 * `cloud_agent_credential` is that key, one per person, workspace and vendor,
 * sealed with AES-256-GCM under `CLOUD_AGENTS_KEY` (`bytea`), with what the
 * vendor said about it when it was stored (its name, the account's address
 * and id). It goes with the workspace and with the person.
 *
 * `cloud_agent` is an agent launched here: the vendor's id for it, what it
 * was asked, and what the vendor last said about its latest run. Its id is
 * chosen before the vendor is asked and is also the vendor's (Cursor's
 * `bc-<id>`), so it has no default. Only agents launched here are rows; the
 * vendor's other agents (started on its web page, from Slack) are not
 * imported. A cloud agent is its own table rather than a third place of
 * `work_session`: a session is the fold of a host's event log, with a host,
 * a tmux session and checkouts, none of which a vendor's agent has.
 *
 * Access patterns:
 * - a person's agents, newest first: `IDX_cloud_agent_owner`
 *   (`createdByUserId`, `organizationId`, `createdAt`, `id`), which also backs
 *   the foreign key to the person;
 * - one agent by id, with its owner: the primary key;
 * - a workspace's delete: `IDX_cloud_agent_organization`;
 * - a person's key for a vendor: `UQ_cloud_agent_credential_user_provider`,
 *   whose leading column backs the foreign key to the workspace;
 *   `IDX_cloud_agent_credential_user` backs the one to the person.
 *
 * Retention: an agent row is small and lives as long as the person and the
 * workspace do; there is no delete yet, and none is needed at fifty shown.
 *
 * `owner` gains `manage CloudAgent` in its workspace, as it holds `Session`.
 */
export class AddCloudAgents1791004000000 implements MigrationInterface {
  name = 'AddCloudAgents1791004000000';

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

    await queryRunner.query(
      `CREATE TABLE cloud_agent (
        id uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "createdByUserId" uuid NOT NULL,
        provider character varying(16) NOT NULL,
        "externalId" character varying(64) NOT NULL,
        url text,
        name character varying(200) NOT NULL,
        prompt text NOT NULL,
        "repositoryUrl" character varying(500) NOT NULL,
        "startingRef" character varying(255),
        model character varying(100),
        "autoCreatePr" boolean DEFAULT false NOT NULL,
        status character varying(16) NOT NULL,
        "latestRunId" character varying(64) NOT NULL,
        branch character varying(255),
        "pullRequestUrl" text,
        summary text,
        "syncedAt" timestamp with time zone NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_cloud_agent" PRIMARY KEY (id),
        CONSTRAINT "UQ_cloud_agent_external" UNIQUE (provider, "externalId"),
        CONSTRAINT "CHK_cloud_agent_provider" CHECK (provider IN ('cursor')),
        CONSTRAINT "CHK_cloud_agent_status" CHECK (status IN ('starting', 'running', 'finished', 'failed', 'cancelled', 'expired'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cloud_agent_owner" ON cloud_agent USING btree ("createdByUserId", "organizationId", "createdAt", id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cloud_agent_organization" ON cloud_agent USING btree ("organizationId")`,
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
    await queryRunner.query('DROP TABLE cloud_agent');
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
  `ALTER TABLE cloud_agent ADD CONSTRAINT "FK_cloud_agent_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE cloud_agent ADD CONSTRAINT "FK_cloud_agent_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE CASCADE`,
];
