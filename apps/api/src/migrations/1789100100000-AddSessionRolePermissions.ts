import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a workspace owner reach its own sessions.
 *
 * `AbilityFactory` builds an ability from the roles in the database and only falls
 * back to `SYSTEM_ROLE_PERMISSIONS` when an account holds no database role. Every
 * personal workspace holds the org-scoped `owner` role (`AddOwnerRole`), which was
 * seeded before `Session` existed — so without this migration every session route
 * answers 403 for the person who owns the workspace.
 *
 * The rule mirrors `SYSTEM_ROLE_PERMISSIONS.owner`'s `Session` entry in
 * `@oppenheimer/shared` exactly, so a freshly seeded database and a migrated one
 * grant the same thing. `${activeOrganizationId}` is escaped because it is a
 * placeholder the ability builder interpolates, not a template literal.
 *
 * Appends only where nothing already decides `Session`, and `down()` removes exactly
 * the rule added here — so an administrator's narrowed or inverted rule is never
 * touched. The `roleVersion` bump is what makes the change visible: role rules are
 * cached per organization on that column.
 */
const SESSION_RULE =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder the ability builder interpolates, not a template literal
  '{"action":"manage","subject":"Session","conditions":{"organizationId":"${activeOrganizationId}"}}';

export class AddSessionRolePermissions1789100100000 implements MigrationInterface {
  name = 'AddSessionRolePermissions1789100100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = "permissions" || '[${SESSION_RULE}]'::jsonb,
              "updatedAt" = now()
        WHERE "name" = 'owner'
          AND NOT (
                "permissions" @> '[${SESSION_RULE}]'::jsonb
             OR "permissions" @> '[{"action":"manage","subject":"all"}]'::jsonb
              )`,
    );
    await queryRunner.query(`UPDATE "organization" SET "roleVersion" = "roleVersion" + 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE rule <> '${SESSION_RULE}'::jsonb
              ),
              "updatedAt" = now()
        WHERE "name" = 'owner'`,
    );
    await queryRunner.query(`UPDATE "organization" SET "roleVersion" = "roleVersion" + 1`);
  }
}
