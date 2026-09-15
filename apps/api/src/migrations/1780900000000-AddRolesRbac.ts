import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces database-backed, admin-managed roles (dynamic RBAC):
 *   - `role`       — roles and their CASL permission set (jsonb).
 *   - `user_role`  — many-to-many assignment of roles to users.
 *
 * Seeds the `admin` / `user` system roles (mirroring the previously hardcoded
 * permissions) and backfills `user_role` from the legacy `user.role` column so
 * existing users keep their effective permissions.
 */
export class AddRolesRbac1780900000000 implements MigrationInterface {
  name = 'AddRolesRbac1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "role" ("id" uuid NOT NULL, "name" character varying NOT NULL, "description" character varying, "isSystem" boolean NOT NULL DEFAULT false, "permissions" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_role_name" UNIQUE ("name"), CONSTRAINT "PK_role_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "user_role" ("userId" uuid NOT NULL, "roleId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_user_role" PRIMARY KEY ("userId", "roleId"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_user_role_userId" ON "user_role" ("userId")`);
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_user_role_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_user_role_role" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Seed the system roles (their permissions mirror the old hardcoded ability).
    await queryRunner.query(
      `INSERT INTO "role" ("id", "name", "description", "isSystem", "permissions") VALUES
        (gen_random_uuid(), 'admin', 'Full access to everything.', true, '[{"action":"manage","subject":"all"}]'),
        (gen_random_uuid(), 'user', 'Standard authenticated user.', true, '[{"action":"read","subject":"User"},{"action":"update","subject":"User"},{"action":"read","subject":"Article"},{"action":"create","subject":"Article"}]')`,
    );

    // Backfill assignments from the legacy single-role column.
    await queryRunner.query(
      `INSERT INTO "user_role" ("userId", "roleId")
        SELECT u."id", r."id" FROM "user" u JOIN "role" r ON r."name" = u."role"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_role" DROP CONSTRAINT "FK_user_role_role"`);
    await queryRunner.query(`ALTER TABLE "user_role" DROP CONSTRAINT "FK_user_role_user"`);
    await queryRunner.query(`DROP INDEX "IDX_user_role_userId"`);
    await queryRunner.query(`DROP TABLE "user_role"`);
    await queryRunner.query(`DROP TABLE "role"`);
  }
}
