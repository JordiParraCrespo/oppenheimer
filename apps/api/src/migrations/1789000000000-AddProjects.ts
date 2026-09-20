import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Projects: the bodies of work sessions belong to, and the names their
 * directories take (`product/11-workspace-layout.md`,
 * `product/versions/mvp/03-control-plane.md`).
 *
 * Two uniqueness rules, answering different questions:
 *
 *  - `UQ_project_organization_origin` is the **identity** — one GitHub
 *    repository, one project — and the conflict target the create statement
 *    names, so two concurrent first sessions on one repository cannot both
 *    create. Partial, because a project with no origin is possible and several
 *    of those must not collide on `NULL`.
 *  - `UQ_project_organization_slug` is the **directory name**, which two
 *    different repositories can derive alike (`acme/xrp-mobile` and
 *    `other/xrp-mobile`), and is what makes the second of them take the next
 *    candidate: `<owner>--<repo>`.
 *
 * `ON DELETE RESTRICT`, not `CASCADE`: a project's slug is a directory name that
 * is never reissued, so deleting the workspace must not quietly evaporate the
 * rows that hold those names out of circulation.
 *
 * `archivedAt` is created unused. Retiring a project has to refuse while work is
 * still going on inside its directory, which needs the module that owns sessions
 * to answer, so archiving lands there — with the column already in place.
 */
export class AddProjects1789000000000 implements MigrationInterface {
  name = 'AddProjects1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project" (
        "id"                 uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId"     uuid NOT NULL,
        "name"               character varying NOT NULL,
        "slug"               character varying NOT NULL,
        "originGithubRepoId" bigint,
        "archivedAt"         TIMESTAMP,
        "createdAt"          TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"          TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_organization_slug" UNIQUE ("organizationId", "slug"),
        CONSTRAINT "FK_project_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_project_organization" ON "project" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_organization_origin"
         ON "project" ("organizationId", "originGithubRepoId")
       WHERE "originGithubRepoId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_project_organization_origin"`);
    await queryRunner.query(`DROP INDEX "IDX_project_organization"`);
    await queryRunner.query(`DROP TABLE "project"`);
  }
}
