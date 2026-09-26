import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Projects become a saved scope a person creates
 * (`product/versions/mvp/12-projects.md`).
 *
 *  - **`project` gains its defaults.** `defaultHostId` is a suggestion, never a
 *    grant: creating a session still loads the host through the own-or-grant
 *    scoped repository. It is `ON DELETE SET NULL` because a default that points
 *    at nothing is simply no default. `createdByUserId` is audit and, like
 *    `github_installation.installedByUserId`, never cascades: the project is the
 *    workspace's, not the person's who clicked.
 *  - **`project_repository` is configuration, not history.** A removed repository
 *    is a deleted row; sessions keep what they checked out on their own
 *    `session_checkout` rows. The two composite keys make "a project holding
 *    another workspace's installation" unrepresentable, as they do for checkouts.
 *    `(organizationId, githubRepoId)` answers "which projects include this
 *    repository", which moving a session asks.
 *  - **The backfill** gives every existing auto-created project its origin as its
 *    one default repository, reading the installation, the name snapshot and the
 *    base branch from the most recent checkout of that repository in that
 *    workspace. A project with no checkout to read them from gets no row; the
 *    one-repository invariant is enforced on write, not assumed on read.
 *  - **`work_session.homeProjectId`** is the project whose directory holds the
 *    session's tree. It is set once and never changes, so moving a session to
 *    another project (`projectId`) never moves anything on disk. The slug's
 *    uniqueness moves with it: `(homeProjectId, slug)` is the directory, and
 *    `(projectId, slug)` would refuse a move for a name clash that is not a
 *    directory clash at all. The new constraint is added before the old one is
 *    dropped, so the tombstone is never absent.
 */
export class AddProjectScopes1789700000000 implements MigrationInterface {
  name = 'AddProjectScopes1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
        ADD COLUMN "createdByUserId" uuid,
        ADD COLUMN "defaultHostId"   uuid,
        ADD COLUMN "defaultAgent"    character varying,
        ADD COLUMN "instructions"    text NOT NULL DEFAULT '',
        ADD CONSTRAINT "FK_project_created_by"
          FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION,
        ADD CONSTRAINT "FK_project_default_host"
          FOREIGN KEY ("defaultHostId") REFERENCES "host"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    // Every foreign key gets its index: a host or a user delete would otherwise
    // scan the table to find the rows it must null.
    await queryRunner.query(
      `CREATE INDEX "IDX_project_default_host" ON "project" ("defaultHostId")
         WHERE "defaultHostId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_created_by" ON "project" ("createdByUserId")
         WHERE "createdByUserId" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "project_repository" (
        "id"                 uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId"     uuid NOT NULL,
        "projectId"          uuid NOT NULL,
        "installationId"     uuid NOT NULL,
        "githubRepoId"       bigint NOT NULL,
        "repositoryFullName" character varying NOT NULL,
        "baseBranch"         character varying NOT NULL,
        "isDefault"          boolean NOT NULL,
        "position"           smallint NOT NULL,
        "createdAt"          timestamptz NOT NULL DEFAULT now(),
        "updatedAt"          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_repository" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_repository_project_repo" UNIQUE ("projectId", "githubRepoId"),
        CONSTRAINT "FK_project_repository_project"
          FOREIGN KEY ("organizationId", "projectId")
          REFERENCES "project"("organizationId", "id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_project_repository_installation"
          FOREIGN KEY ("organizationId", "installationId")
          REFERENCES "github_installation"("organizationId", "id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_project_repository_organization_repo"
         ON "project_repository" ("organizationId", "githubRepoId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_repository_installation"
         ON "project_repository" ("organizationId", "installationId")`,
    );

    await queryRunner.query(`
      INSERT INTO "project_repository"
        ("organizationId", "projectId", "installationId", "githubRepoId",
         "repositoryFullName", "baseBranch", "isDefault", "position")
      SELECT DISTINCT ON (p."id")
             p."organizationId", p."id", c."installationId", p."originGithubRepoId",
             c."repositoryFullName", c."baseBranch", true, 0
        FROM "project" p
        JOIN "session_checkout" c
          ON c."organizationId" = p."organizationId"
         AND c."githubRepoId" = p."originGithubRepoId"
       WHERE p."originGithubRepoId" IS NOT NULL
       ORDER BY p."id", c."createdAt" DESC
    `);

    await queryRunner.query(`ALTER TABLE "work_session" ADD COLUMN "homeProjectId" uuid`);
    await queryRunner.query(`UPDATE "work_session" SET "homeProjectId" = "projectId"`);
    await queryRunner.query(`ALTER TABLE "work_session" ALTER COLUMN "homeProjectId" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "work_session"
        ADD CONSTRAINT "FK_work_session_home_project"
          FOREIGN KEY ("organizationId", "homeProjectId")
          REFERENCES "project"("organizationId", "id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "work_session"
        ADD CONSTRAINT "UQ_work_session_home_project_slug" UNIQUE ("homeProjectId", "slug")
    `);
    await queryRunner.query(
      `ALTER TABLE "work_session" DROP CONSTRAINT "UQ_work_session_project_slug"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A session that moved has `projectId` ≠ `homeProjectId`; putting it back in
    // its home is the only state the old schema can describe, because the old
    // schema's project *was* the directory.
    await queryRunner.query(`UPDATE "work_session" SET "projectId" = "homeProjectId"`);
    await queryRunner.query(`
      ALTER TABLE "work_session"
        ADD CONSTRAINT "UQ_work_session_project_slug" UNIQUE ("projectId", "slug")
    `);
    await queryRunner.query(
      `ALTER TABLE "work_session" DROP CONSTRAINT "UQ_work_session_home_project_slug"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_session" DROP CONSTRAINT "FK_work_session_home_project"`,
    );
    await queryRunner.query(`ALTER TABLE "work_session" DROP COLUMN "homeProjectId"`);

    await queryRunner.query(`DROP TABLE "project_repository"`);

    await queryRunner.query(`DROP INDEX "IDX_project_created_by"`);
    await queryRunner.query(`DROP INDEX "IDX_project_default_host"`);
    await queryRunner.query(`
      ALTER TABLE "project"
        DROP CONSTRAINT "FK_project_default_host",
        DROP CONSTRAINT "FK_project_created_by",
        DROP COLUMN "instructions",
        DROP COLUMN "defaultAgent",
        DROP COLUMN "defaultHostId",
        DROP COLUMN "createdByUserId"
    `);
  }
}
