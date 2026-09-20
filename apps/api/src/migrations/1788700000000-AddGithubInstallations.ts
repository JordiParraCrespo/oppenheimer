import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The one table the `github/` module owns: which GitHub App installations a
 * workspace has claimed.
 *
 * There is deliberately no repository table. The installation *is* the access
 * control and GitHub enforces it server-side, so the repository list is asked
 * for live and a repository is remembered only by the checkout that took it
 * (`product/versions/mvp/03-control-plane.md`).
 *
 * The constraints carry the design:
 *
 *  - `githubInstallationId` is unique among **live** rows only. A claim is
 *    something a workspace holds, not something it once touched: a disconnected
 *    or uninstalled row keeps its history and stops occupying the number, so
 *    another workspace can connect the same installation once it is free and
 *    `GITHUB_003` means "someone holds this" rather than "someone once did".
 *    TypeORM cannot express a partial index, which is why it is written here.
 *  - `(organizationId, id)` is unique so a checkout in a later slice can carry a
 *    composite foreign key and be structurally unable to reference another
 *    tenant's installation.
 *  - `deletedAt` is nullable rather than the row being removed: GitHub still has
 *    the installation, and a checkout that named it needs something that can
 *    explain why its repository stopped resolving.
 *  - `installedByUserId` is **audit, not ownership**. The installation belongs to
 *    the organization, so deleting the person who clicked Connect must not take
 *    the workspace's GitHub access — and every checkout that named it — with
 *    them. Hence `RESTRICT` rather than `CASCADE`.
 */
export class AddGithubInstallations1788700000000 implements MigrationInterface {
  name = 'AddGithubInstallations1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "github_installation" (
        "id"                    uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId"        uuid NOT NULL,
        "githubInstallationId"  bigint NOT NULL,
        "accountLogin"          character varying NOT NULL,
        "accountType"           character varying NOT NULL,
        "repositorySelection"   character varying NOT NULL,
        "installedByUserId"     uuid NOT NULL,
        "suspendedAt"           TIMESTAMP,
        "deletedAt"             TIMESTAMP,
        "createdAt"             TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_github_installation" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_github_installation_organization_id" UNIQUE ("organizationId", "id"),
        CONSTRAINT "CHK_github_installation_repository_selection"
          CHECK ("repositorySelection" IN ('all', 'selected')),
        CONSTRAINT "CHK_github_installation_account_type"
          CHECK ("accountType" IN ('User', 'Organization')),
        CONSTRAINT "FK_github_installation_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_github_installation_installed_by"
          FOREIGN KEY ("installedByUserId") REFERENCES "user"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_github_installation_organization" ON "github_installation" ("organizationId")`,
    );
    // The live-claim constraint, and the reason it is an index rather than a
    // table constraint: only one workspace may hold a GitHub installation at a
    // time, and the rows a workspace left behind are history, not a claim.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_github_installation_live_github_id"
         ON "github_installation" ("githubInstallationId")
       WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_github_installation_live_github_id"`);
    await queryRunner.query(`DROP INDEX "IDX_github_installation_organization"`);
    await queryRunner.query(`DROP TABLE "github_installation"`);
  }
}
