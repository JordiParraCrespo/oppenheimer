import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Pull requests area (`product/next-steps/0.2-pull-requests-api-plan.md`).
 * Pull requests themselves are GitHub's and are read through the installation,
 * so two small tables are all it stores:
 *
 * - `github_user_grant`: a person's GitHub user token from the App's install
 *   authorization, both tokens sealed with AES-256-GCM under
 *   `GITHUB_USER_TOKEN_KEY` (`bytea`), so reviews and merges are made in their
 *   name. One per person, gone with them.
 * - `watched_repository`: the repositories a person switched off (or back on)
 *   in a workspace. No row means watched. Gone with the workspace, the person or
 *   the installation.
 *
 * And the owner role's rule for the new `PullRequest` subject, with the role
 * catalog's version bumped so cached abilities pick it up.
 */
export class AddPullRequests1791000400000 implements MigrationInterface {
  name = 'AddPullRequests1791000400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE github_user_grant (
        "userId" uuid NOT NULL,
        "githubUserId" bigint NOT NULL,
        login character varying(100) NOT NULL,
        "accessTokenSealed" bytea NOT NULL,
        "accessExpiresAt" timestamp with time zone,
        "refreshTokenSealed" bytea,
        "refreshExpiresAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_github_user_grant" PRIMARY KEY ("userId")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE watched_repository (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "installationId" uuid NOT NULL,
        "githubRepoId" bigint NOT NULL,
        watching boolean NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_watched_repository" PRIMARY KEY (id),
        CONSTRAINT "UQ_watched_repository" UNIQUE ("organizationId", "userId", "installationId", "githubRepoId")
      )`,
    );
    // The unique key leads with the workspace and the person, which is the one read.
    await queryRunner.query(
      `CREATE INDEX "IDX_watched_repository_user" ON watched_repository USING btree ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_watched_repository_installation" ON watched_repository USING btree ("installationId")`,
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
    await queryRunner.query('DROP TABLE watched_repository');
    await queryRunner.query('DROP TABLE github_user_grant');
  }
}

const OWNER_RULES = [
  {
    action: 'manage',
    subject: 'PullRequest',
    conditions: { organizationId: '${activeOrganizationId}' },
  },
];

const FOREIGN_KEYS = [
  `ALTER TABLE github_user_grant ADD CONSTRAINT "FK_github_user_grant_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  `ALTER TABLE watched_repository ADD CONSTRAINT "FK_watched_repository_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE watched_repository ADD CONSTRAINT "FK_watched_repository_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  `ALTER TABLE watched_repository ADD CONSTRAINT "FK_watched_repository_installation" FOREIGN KEY ("installationId") REFERENCES github_installation(id) ON DELETE CASCADE`,
];
