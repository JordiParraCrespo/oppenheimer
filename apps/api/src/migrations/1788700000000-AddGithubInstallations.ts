import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The one table the `github/` module owns: which GitHub App installations a
 * workspace has claimed.
 *
 * There is deliberately no repository table. The installation *is* the
 * allowlist and GitHub enforces it server-side, so the repository list is asked
 * for live and a checkout records the ids it took inline
 * (`product/09-github-app-install.md`). A mirror would only add the failure mode
 * "in our copy but the token mint fails".
 *
 * Three constraints carry the design:
 *
 *  - `githubInstallationId` is unique **globally**, which is what makes a second
 *    workspace's claim on the same installation a 409 rather than a takeover;
 *  - `(organizationId, id)` is unique so a checkout in a later slice can carry a
 *    composite foreign key and be structurally unable to reference another
 *    tenant's installation;
 *  - `deletedAt` is nullable rather than the row being removed: GitHub still has
 *    the installation, and a checkout that named it needs something that can
 *    explain why its repository stopped resolving.
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
        CONSTRAINT "UQ_github_installation_github_id" UNIQUE ("githubInstallationId"),
        CONSTRAINT "UQ_github_installation_organization_id" UNIQUE ("organizationId", "id"),
        CONSTRAINT "CHK_github_installation_repository_selection"
          CHECK ("repositorySelection" IN ('all', 'selected')),
        CONSTRAINT "FK_github_installation_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_github_installation_installed_by"
          FOREIGN KEY ("installedByUserId") REFERENCES "user"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_github_installation_organization" ON "github_installation" ("organizationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_github_installation_organization"`);
    await queryRunner.query(`DROP TABLE "github_installation"`);
  }
}
