import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Projects are named and metadata only; every workspace has an Unassigned one;
 * sessions are flat on disk (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * Runs after `AddProjectDefaultsAndRepositories`, which gave `project` its
 * defaults and created `project_repository`; this one finishes that table and
 * retires the auto-created project.
 *
 *  - **`project_repository` is tenant-keyed.** It gains `organizationId`, and its
 *    two foreign keys become composite, so a project holding another workspace's
 *    installation is unrepresentable, as it is for a checkout. A disconnected
 *    installation still takes its rows with it. `fullName` is renamed
 *    `repositoryFullName`, the checkout's spelling of the same snapshot. The base
 *    branch becomes required: a row written without one takes the base its
 *    repository's latest checkout in the workspace used, else `main`. `position`
 *    keeps the order a person put the rows in.
 *  - **The backfill** gives every project that was auto-created from a repository
 *    that repository as its one default, read from its latest checkout, when it
 *    holds no row yet.
 *  - **`originGithubRepoId` goes, after the backfill has read it.** A project is
 *    created on purpose and never derived from a repository.
 *  - **Unassigned.** `isUnassigned` marks the one project per workspace that a
 *    session lands in when it names none; a partial unique index keeps it one.
 *    Every workspace gets its row here, under the slug `unassigned` unless a
 *    project already holds that.
 *  - **A session's slug is unique per workspace**, not per project: a session's
 *    directory is `workspaces/<org>/sessions/<slug>` and its branch
 *    `oppenheimer/<slug>`, so a session can move between projects without
 *    anything moving. The new constraint is added before the old one is
 *    dropped, so the tombstone is never absent.
 */
export class NameProjectsAndFlattenSessions1789800000000 implements MigrationInterface {
  name = 'NameProjectsAndFlattenSessions1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
        ADD COLUMN "createdByUserId" uuid,
        ADD COLUMN "isUnassigned"    boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT "FK_project_created_by"
          FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_project_created_by" ON "project" ("createdByUserId")
         WHERE "createdByUserId" IS NOT NULL`,
    );

    // --- project_repository: tenant-keyed, ordered, a base on every row ---
    await queryRunner.query(`
      ALTER TABLE "project_repository"
        ADD COLUMN "organizationId" uuid,
        ADD COLUMN "position"       smallint,
        ADD COLUMN "updatedAt"      timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(
      `ALTER TABLE "project_repository" RENAME COLUMN "fullName" TO "repositoryFullName"`,
    );
    await queryRunner.query(`
      UPDATE "project_repository" r
         SET "organizationId" = p."organizationId"
        FROM "project" p
       WHERE p."id" = r."projectId"
    `);
    await queryRunner.query(`
      UPDATE "project_repository" r
         SET "position" = ordered."position"
        FROM (
          SELECT "id",
                 (row_number() OVER (PARTITION BY "projectId" ORDER BY "createdAt", "id") - 1)::smallint
                   AS "position"
            FROM "project_repository"
        ) ordered
       WHERE ordered."id" = r."id"
    `);
    await queryRunner.query(`
      UPDATE "project_repository" r
         SET "baseBranch" = COALESCE(
           (SELECT c."baseBranch"
              FROM "session_checkout" c
             WHERE c."organizationId" = r."organizationId"
               AND c."githubRepoId" = r."githubRepoId"
             ORDER BY c."createdAt" DESC
             LIMIT 1),
           'main')
       WHERE r."baseBranch" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "project_repository"
        ALTER COLUMN "organizationId" SET NOT NULL,
        ALTER COLUMN "position" SET NOT NULL,
        ALTER COLUMN "baseBranch" SET NOT NULL,
        ALTER COLUMN "isDefault" DROP DEFAULT,
        DROP CONSTRAINT "FK_project_repository_project",
        DROP CONSTRAINT "FK_project_repository_installation",
        ADD CONSTRAINT "FK_project_repository_project"
          FOREIGN KEY ("organizationId", "projectId")
          REFERENCES "project"("organizationId", "id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        ADD CONSTRAINT "FK_project_repository_installation"
          FOREIGN KEY ("organizationId", "installationId")
          REFERENCES "github_installation"("organizationId", "id")
          ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`DROP INDEX "IDX_project_repository_installation"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_project_repository_installation"
         ON "project_repository" ("organizationId", "installationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_repository_organization_repo"
         ON "project_repository" ("organizationId", "githubRepoId")`,
    );

    // --- the auto-created project becomes an ordinary one ---
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
         AND NOT EXISTS (SELECT 1 FROM "project_repository" r WHERE r."projectId" = p."id")
       ORDER BY p."id", c."createdAt" DESC
    `);
    await queryRunner.query(`DROP INDEX "UQ_project_organization_origin"`);
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "originGithubRepoId"`);

    // --- Unassigned, one per workspace ---
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_organization_unassigned"
         ON "project" ("organizationId") WHERE "isUnassigned"`,
    );
    await queryRunner.query(`
      INSERT INTO "project" ("organizationId", "name", "slug", "isUnassigned")
      SELECT o."id", 'Unassigned',
             CASE WHEN EXISTS (
               SELECT 1 FROM "project" p WHERE p."organizationId" = o."id" AND p."slug" = 'unassigned'
             ) THEN 'unassigned-' || substr(md5(o."id"::text), 1, 8) ELSE 'unassigned' END,
             true
        FROM "organization" o
    `);

    // --- sessions are flat: a slug is unique in the workspace ---
    await queryRunner.query(`
      ALTER TABLE "work_session"
        ADD CONSTRAINT "UQ_work_session_organization_slug" UNIQUE ("organizationId", "slug")
    `);
    await queryRunner.query(
      `ALTER TABLE "work_session" DROP CONSTRAINT "UQ_work_session_project_slug"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_session"
        ADD CONSTRAINT "UQ_work_session_project_slug" UNIQUE ("projectId", "slug")
    `);
    await queryRunner.query(
      `ALTER TABLE "work_session" DROP CONSTRAINT "UQ_work_session_organization_slug"`,
    );

    // An Unassigned project that holds sessions stays, as an ordinary project.
    await queryRunner.query(`
      DELETE FROM "project" p
       WHERE p."isUnassigned"
         AND NOT EXISTS (SELECT 1 FROM "work_session" s WHERE s."projectId" = p."id")
    `);
    await queryRunner.query(`DROP INDEX "UQ_project_organization_unassigned"`);

    // The origin comes back empty: a project a person created has none, and
    // guessing one from its repositories could claim a repository for two
    // projects, which the restored unique index forbids.
    await queryRunner.query(`ALTER TABLE "project" ADD COLUMN "originGithubRepoId" bigint`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_organization_origin"
         ON "project" ("organizationId", "originGithubRepoId")
       WHERE "originGithubRepoId" IS NOT NULL`,
    );

    await queryRunner.query(`DROP INDEX "IDX_project_repository_organization_repo"`);
    await queryRunner.query(`DROP INDEX "IDX_project_repository_installation"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_project_repository_installation" ON "project_repository" ("installationId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "project_repository"
        DROP CONSTRAINT "FK_project_repository_installation",
        DROP CONSTRAINT "FK_project_repository_project",
        ADD CONSTRAINT "FK_project_repository_project"
          FOREIGN KEY ("projectId") REFERENCES "project"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        ADD CONSTRAINT "FK_project_repository_installation"
          FOREIGN KEY ("installationId") REFERENCES "github_installation"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        ALTER COLUMN "isDefault" SET DEFAULT false,
        ALTER COLUMN "baseBranch" DROP NOT NULL,
        DROP COLUMN "updatedAt",
        DROP COLUMN "position",
        DROP COLUMN "organizationId"
    `);
    await queryRunner.query(
      `ALTER TABLE "project_repository" RENAME COLUMN "repositoryFullName" TO "fullName"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_project_created_by"`);
    await queryRunner.query(`
      ALTER TABLE "project"
        DROP CONSTRAINT "FK_project_created_by",
        DROP COLUMN "isUnassigned",
        DROP COLUMN "createdByUserId"
    `);
  }
}
