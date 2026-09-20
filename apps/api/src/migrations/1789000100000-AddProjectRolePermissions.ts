import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a workspace owner reach its own projects.
 *
 * `AbilityFactory` builds an ability from the roles in the database and only
 * falls back to `SYSTEM_ROLE_PERMISSIONS` when an account holds no database
 * role. Every personal workspace holds the org-scoped `owner` role
 * (`AddOwnerRole`), which was seeded before `Project` existed — so without this
 * migration every project route answers 403 for the person who owns the
 * workspace, and only the platform tier can call them.
 *
 * The rule mirrors `SYSTEM_ROLE_PERMISSIONS.owner`'s `Project` entry in
 * `@oppenheimer/shared` exactly, so a freshly seeded database and a migrated one
 * grant the same thing. `${activeOrganizationId}` is escaped because it is a
 * placeholder the ability builder interpolates, not a template literal.
 *
 * Appends only where nothing already decides `Project`, and `down()` removes
 * exactly the rule added here — so an administrator's narrowed or inverted rule
 * is never touched. The `roleVersion` bump is what makes the change visible:
 * role rules are cached per organization on that column.
 */
const PROJECT_RULE =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder the ability builder interpolates, not a template literal
  '{"action":"manage","subject":"Project","conditions":{"organizationId":"${activeOrganizationId}"}}';

export class AddProjectRolePermissions1789000100000 implements MigrationInterface {
  name = 'AddProjectRolePermissions1789000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = "permissions" || '[${PROJECT_RULE}]'::jsonb,
              "updatedAt" = now()
        WHERE "name" = 'owner'
          AND NOT (
                "permissions" @> '[${PROJECT_RULE}]'::jsonb
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
                 WHERE rule <> '${PROJECT_RULE}'::jsonb
              ),
              "updatedAt" = now()
        WHERE "name" = 'owner'`,
    );
    await queryRunner.query(`UPDATE "organization" SET "roleVersion" = "roleVersion" + 1`);
  }
}
