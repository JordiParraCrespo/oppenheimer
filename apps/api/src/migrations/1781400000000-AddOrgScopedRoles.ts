import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes roles and their assignments organization-scoped.
 *
 * Until now `role.name` was unique across the whole table and `user_role`
 * carried no organization, so two tenants could not both define a `manager`
 * role and a role granted in one organization applied in every other. That is
 * the blocking defect for multi-tenancy.
 *
 * `organizationId IS NULL` keeps its existing meaning of "global": the seeded
 * system roles stay global, and every existing row backfills to NULL, so
 * behaviour is unchanged until roles are deliberately scoped.
 *
 * Also adds `organization.roleVersion`, the cache key for a tenant's role
 * rules. It is bumped in the same transaction as any role write rather than
 * through the outbox, because outbox delivery is retried on failure and
 * therefore cannot guarantee the next request sees the change.
 */
export class AddOrgScopedRoles1781400000000 implements MigrationInterface {
  name = 'AddOrgScopedRoles1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- role ------------------------------------------------------------
    await queryRunner.query(`ALTER TABLE "role" ADD COLUMN "organizationId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "role" ADD CONSTRAINT "FK_role_organization" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // A single unique index cannot express "unique per tenant, and unique
    // among globals" because Postgres treats NULLs as distinct. Two partial
    // indexes do.
    await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "UQ_role_name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_role_org_name" ON "role" ("organizationId", "name") WHERE "organizationId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_role_global_name" ON "role" ("name") WHERE "organizationId" IS NULL`,
    );

    // --- user_role -------------------------------------------------------
    await queryRunner.query(`ALTER TABLE "user_role" ADD COLUMN "organizationId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_user_role_organization" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // The composite primary key cannot include the nullable organization, so
    // move to a surrogate key with partial uniqueness for the two shapes.
    await queryRunner.query(`ALTER TABLE "user_role" DROP CONSTRAINT "PK_user_role"`);
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD COLUMN "id" uuid NOT NULL DEFAULT gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "PK_user_role" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_role_scoped" ON "user_role" ("userId", "roleId", "organizationId") WHERE "organizationId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_role_global" ON "user_role" ("userId", "roleId") WHERE "organizationId" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_role_user_org" ON "user_role" ("userId", "organizationId")`,
    );

    // --- cache versioning ------------------------------------------------
    await queryRunner.query(
      `ALTER TABLE "organization" ADD COLUMN "roleVersion" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "roleVersion"`);

    await queryRunner.query(`DROP INDEX "IDX_user_role_user_org"`);
    await queryRunner.query(`DROP INDEX "UQ_user_role_global"`);
    await queryRunner.query(`DROP INDEX "UQ_user_role_scoped"`);
    await queryRunner.query(`ALTER TABLE "user_role" DROP CONSTRAINT "PK_user_role"`);
    await queryRunner.query(`ALTER TABLE "user_role" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "PK_user_role" PRIMARY KEY ("userId", "roleId")`,
    );
    await queryRunner.query(`ALTER TABLE "user_role" DROP CONSTRAINT "FK_user_role_organization"`);
    await queryRunner.query(`ALTER TABLE "user_role" DROP COLUMN "organizationId"`);

    await queryRunner.query(`DROP INDEX "UQ_role_global_name"`);
    await queryRunner.query(`DROP INDEX "UQ_role_org_name"`);
    await queryRunner.query(`ALTER TABLE "role" ADD CONSTRAINT "UQ_role_name" UNIQUE ("name")`);
    await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "FK_role_organization"`);
    await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "organizationId"`);
  }
}
