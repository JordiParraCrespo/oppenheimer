import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A project made on the console (`product/versions/mvp/12-projects-on-the-console.md`):
 * the defaults New session is prefilled with, and the repositories it holds.
 *
 * `defaultHostId` is `ON DELETE SET NULL`: removing a machine must not take a
 * project with it, and a project whose default host is gone is one whose chip
 * simply starts empty. `defaultAgent` is a catalog id, checked at the boundary
 * rather than by an enum column, so a new agent is a row in the catalog and not
 * a migration.
 *
 * `project_repository` cascades from both sides it hangs on: a project's rows
 * go with the project (archiving keeps the row, so this only fires on a
 * workspace delete, which is already `RESTRICT` above it), and a disconnected
 * installation takes its repositories with it, because a repository nobody can
 * mint a token for is not one a session can check out. `fullName` is a display
 * snapshot, as on a checkout, so the sidebar and the dialog print a name
 * without a GitHub call.
 */
export class AddProjectDefaultsAndRepositories1789700000000 implements MigrationInterface {
  name = 'AddProjectDefaultsAndRepositories1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project" ADD "defaultHostId" uuid`);
    await queryRunner.query(`ALTER TABLE "project" ADD "defaultAgent" character varying`);
    await queryRunner.query(
      `ALTER TABLE "project"
         ADD CONSTRAINT "FK_project_default_host"
         FOREIGN KEY ("defaultHostId") REFERENCES "host"("id")
         ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_default_host" ON "project" ("defaultHostId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "project_repository" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "projectId"      uuid NOT NULL,
        "installationId" uuid NOT NULL,
        "githubRepoId"   bigint NOT NULL,
        "fullName"       character varying NOT NULL,
        "isDefault"      boolean NOT NULL DEFAULT false,
        "baseBranch"     character varying,
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_repository" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_repository_project_repo" UNIQUE ("projectId", "githubRepoId"),
        CONSTRAINT "FK_project_repository_project"
          FOREIGN KEY ("projectId") REFERENCES "project"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_project_repository_installation"
          FOREIGN KEY ("installationId") REFERENCES "github_installation"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_project_repository_installation" ON "project_repository" ("installationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_project_repository_installation"`);
    await queryRunner.query(`DROP TABLE "project_repository"`);
    await queryRunner.query(`DROP INDEX "IDX_project_default_host"`);
    await queryRunner.query(`ALTER TABLE "project" DROP CONSTRAINT "FK_project_default_host"`);
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "defaultAgent"`);
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "defaultHostId"`);
  }
}
