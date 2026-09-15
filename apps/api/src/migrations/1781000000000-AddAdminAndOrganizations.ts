import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the Better Auth **admin** and **organization** (with teams) plugin
 * schema, plus a `superadmin` system role:
 *
 *   - admin plugin:        `user.banned` / `banReason` / `banExpires`,
 *                          `session.impersonatedBy`.
 *   - organization plugin: `organization`, `member`, `invitation` tables and
 *                          `session.activeOrganizationId`.
 *   - teams (workspaces):  `team`, `teamMember` tables and
 *                          `session.activeTeamId`.
 *
 * Column names use Better Auth's camelCase convention (quoted identifiers) so
 * the plugin's own INSERT/SELECT statements line up with the schema.
 */
export class AddAdminAndOrganizations1781000000000 implements MigrationInterface {
  name = 'AddAdminAndOrganizations1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- admin plugin columns ---
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "banned" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "banReason" character varying`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "banExpires" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "session" ADD COLUMN "impersonatedBy" uuid`);

    // --- organization / teams session columns ---
    await queryRunner.query(`ALTER TABLE "session" ADD COLUMN "activeOrganizationId" uuid`);
    await queryRunner.query(`ALTER TABLE "session" ADD COLUMN "activeTeamId" uuid`);

    // --- organization ---
    await queryRunner.query(
      `CREATE TABLE "organization" ("id" uuid NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "logo" character varying, "metadata" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_organization_slug" UNIQUE ("slug"), CONSTRAINT "PK_organization_id" PRIMARY KEY ("id"))`,
    );

    // --- member ---
    await queryRunner.query(
      `CREATE TABLE "member" ("id" uuid NOT NULL, "organizationId" uuid NOT NULL, "userId" uuid NOT NULL, "role" character varying NOT NULL DEFAULT 'member', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_member_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_member_userId" ON "member" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_member_organizationId" ON "member" ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "member" ADD CONSTRAINT "FK_member_organization" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "member" ADD CONSTRAINT "FK_member_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- team (workspace) ---
    await queryRunner.query(
      `CREATE TABLE "team" ("id" uuid NOT NULL, "name" character varying NOT NULL, "organizationId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP, CONSTRAINT "PK_team_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_team_organizationId" ON "team" ("organizationId")`);
    await queryRunner.query(
      `ALTER TABLE "team" ADD CONSTRAINT "FK_team_organization" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- teamMember ---
    await queryRunner.query(
      `CREATE TABLE "teamMember" ("id" uuid NOT NULL, "teamId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_teamMember_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_teamMember_teamId" ON "teamMember" ("teamId")`);
    await queryRunner.query(`CREATE INDEX "IDX_teamMember_userId" ON "teamMember" ("userId")`);
    await queryRunner.query(
      `ALTER TABLE "teamMember" ADD CONSTRAINT "FK_teamMember_team" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teamMember" ADD CONSTRAINT "FK_teamMember_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- invitation ---
    await queryRunner.query(
      `CREATE TABLE "invitation" ("id" uuid NOT NULL, "organizationId" uuid NOT NULL, "email" character varying NOT NULL, "role" character varying, "status" character varying NOT NULL DEFAULT 'pending', "teamId" uuid, "inviterId" uuid NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_invitation_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invitation_organizationId" ON "invitation" ("organizationId")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_invitation_email" ON "invitation" ("email")`);
    await queryRunner.query(
      `ALTER TABLE "invitation" ADD CONSTRAINT "FK_invitation_organization" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitation" ADD CONSTRAINT "FK_invitation_inviter" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitation" ADD CONSTRAINT "FK_invitation_team" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // --- seed the superadmin system role (full access, like admin). ---
    await queryRunner.query(
      `INSERT INTO "role" ("id", "name", "description", "isSystem", "permissions") VALUES
        (gen_random_uuid(), 'superadmin', 'Platform super administrator (admin plugin: ban, impersonate, manage users).', true, '[{"action":"manage","subject":"all"}]')
        ON CONFLICT ("name") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "role" WHERE "name" = 'superadmin'`);

    await queryRunner.query(`ALTER TABLE "invitation" DROP CONSTRAINT "FK_invitation_team"`);
    await queryRunner.query(`ALTER TABLE "invitation" DROP CONSTRAINT "FK_invitation_inviter"`);
    await queryRunner.query(
      `ALTER TABLE "invitation" DROP CONSTRAINT "FK_invitation_organization"`,
    );
    await queryRunner.query(`DROP TABLE "invitation"`);

    await queryRunner.query(`ALTER TABLE "teamMember" DROP CONSTRAINT "FK_teamMember_user"`);
    await queryRunner.query(`ALTER TABLE "teamMember" DROP CONSTRAINT "FK_teamMember_team"`);
    await queryRunner.query(`DROP TABLE "teamMember"`);

    await queryRunner.query(`ALTER TABLE "team" DROP CONSTRAINT "FK_team_organization"`);
    await queryRunner.query(`DROP TABLE "team"`);

    await queryRunner.query(`ALTER TABLE "member" DROP CONSTRAINT "FK_member_user"`);
    await queryRunner.query(`ALTER TABLE "member" DROP CONSTRAINT "FK_member_organization"`);
    await queryRunner.query(`DROP TABLE "member"`);

    await queryRunner.query(`DROP TABLE "organization"`);

    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "activeTeamId"`);
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "activeOrganizationId"`);
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "impersonatedBy"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "banExpires"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "banReason"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "banned"`);
  }
}
