import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Projects: the bodies of work sessions belong to, and the names their
 * directories take (`product/11-workspace-layout.md`,
 * `product/versions/mvp/03-control-plane.md`).
 *
 * Three constraints carry the design:
 *
 *  - `UQ_project_organization_slug` makes the directory name a database fact
 *    rather than a convention two runner versions could implement differently,
 *    and — since rows are never deleted, only archived — a permanent tombstone
 *    for a retired name. It is also the conflict target the race-safe
 *    auto-creation insert names.
 *  - `UQ_project_organization_id` is redundant for lookups and exists so a
 *    session's composite key can reference `(organizationId, id)`, which makes
 *    a session in another workspace's project unrepresentable rather than
 *    merely unchecked.
 *  - `IDX_project_organization_origin` is the path the auto-creation takes on
 *    every session after the first: find the project by GitHub's repository id
 *    instead of re-deriving a string.
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
        CONSTRAINT "UQ_project_organization_id" UNIQUE ("organizationId", "id"),
        CONSTRAINT "FK_project_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_project_organization" ON "project" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_organization_origin" ON "project" ("organizationId", "originGithubRepoId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_project_organization_origin"`);
    await queryRunner.query(`DROP INDEX "IDX_project_organization"`);
    await queryRunner.query(`DROP TABLE "project"`);
  }
}
