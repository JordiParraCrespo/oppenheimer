import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The tenant-scoped `owner` system role, and the escalation it closes.
 *
 * Creating an organization (and accepting an owner/admin invitation) used to
 * grant the global `admin` role scoped to that organization. `admin` is
 * `manage all`, and `AbilityFactory` unions org-scoped roles into the ability
 * whenever that organization is active — so every self-service account that
 * made a workspace could, with it selected, call any route whose guard checks
 * only action + subject: `DELETE /users/:id`, the admin plugin façade, other
 * tenants' roles. `owner` grants organization resources only, narrowed by the
 * `${activeOrganizationId}` placeholder.
 *
 * The permissions mirror `SYSTEM_ROLE_PERMISSIONS.owner` in `@oppenheimer/shared`.
 *
 * Existing org-scoped `admin` assignments are moved onto `owner`: those are
 * exactly the rows the two membership paths wrote, and leaving them would
 * leave the hole open for every workspace created before this migration.
 * Global `admin` assignments (`organizationId IS NULL`) are the platform tier
 * and are not touched.
 */
export class AddOwnerRole1788500000000 implements MigrationInterface {
  name = 'AddOwnerRole1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "role" ("id", "name", "description", "isSystem", "organizationId", "permissions")
         SELECT gen_random_uuid(), 'owner', 'Administers the organization it is granted in.', true, NULL,
                '[{"action":"manage","subject":"Organization","conditions":{"id":"\${activeOrganizationId}"}},
                  {"action":"manage","subject":"Member","conditions":{"organizationId":"\${activeOrganizationId}"}},
                  {"action":"manage","subject":"Invitation","conditions":{"organizationId":"\${activeOrganizationId}"}},
                  {"action":"manage","subject":"Workspace","conditions":{"organizationId":"\${activeOrganizationId}"}},
                  {"action":"manage","subject":"Role","conditions":{"organizationId":"\${activeOrganizationId}"}}]'::jsonb
          WHERE NOT EXISTS (SELECT 1 FROM "role" WHERE "name" = 'owner' AND "organizationId" IS NULL)`,
    );
    await queryRunner.query(
      `UPDATE "user_role" ur
          SET "roleId" = owner."id"
         FROM "role" admin, "role" owner
        WHERE ur."roleId" = admin."id"
          AND ur."organizationId" IS NOT NULL
          AND admin."name" = 'admin' AND admin."organizationId" IS NULL
          AND owner."name" = 'owner' AND owner."organizationId" IS NULL
          AND NOT EXISTS (
                SELECT 1 FROM "user_role" existing
                 WHERE existing."userId" = ur."userId"
                   AND existing."roleId" = owner."id"
                   AND existing."organizationId" = ur."organizationId"
              )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Put the assignments back where they came from, then drop the role. The
    // cascade on `user_role.roleId` would otherwise silently strip every tenant
    // admin of their workspace.
    await queryRunner.query(
      `UPDATE "user_role" ur
          SET "roleId" = admin."id"
         FROM "role" owner, "role" admin
        WHERE ur."roleId" = owner."id"
          AND owner."name" = 'owner' AND owner."organizationId" IS NULL
          AND admin."name" = 'admin' AND admin."organizationId" IS NULL`,
    );
    await queryRunner.query(
      `DELETE FROM "role" WHERE "name" = 'owner' AND "organizationId" IS NULL`,
    );
  }
}
