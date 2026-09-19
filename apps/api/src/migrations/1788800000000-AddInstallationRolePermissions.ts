import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a workspace's `owner` role manage its GitHub App installations.
 *
 * This mirrors the `Installation` rule in `SYSTEM_ROLE_PERMISSIONS.owner`
 * (`@oppenheimer/shared`): an installation is what the *workspace* was granted, so
 * the rule is narrowed by `${activeOrganizationId}` and nothing else. The
 * constant's other control-plane rules arrive with the slices that own their
 * tables, each in its own migration, so a workspace never holds a rule for a
 * subject with no module behind it yet.
 *
 * There is no `Repository` rule, because there is no repository row: the App
 * installation is the boundary and GitHub answers it, so the routes that list
 * repositories and branches sit on `read Installation` — the access they are
 * about to exercise.
 *
 * It appends only, and only where nothing already decides `manage Installation`:
 * an administrator who narrowed or inverted the rule keeps their version, and
 * `down()` removes exactly the rule added here. Same discipline as
 * `LetDefaultUserCreateWorkspaces` (1788400000000).
 *
 * It is also the first migration in the repository to bump
 * `organization.roleVersion`, because it is the first to change a role's rules
 * for workspaces that already exist: that column is the cache key for a tenant's
 * abilities, so without the bump an existing workspace would keep being refused
 * by the routes this opens until something else invalidated it.
 */

const RULE =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder the ability builder interpolates at request time, not a template string
  '{"action":"manage","subject":"Installation","conditions":{"organizationId":"${activeOrganizationId}"}}';

export class AddInstallationRolePermissions1788800000000 implements MigrationInterface {
  name = 'AddInstallationRolePermissions1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = "permissions" || '[${RULE}]'::jsonb,
              "updatedAt" = now()
        WHERE "name" = 'owner'
          AND "organizationId" IS NULL
          AND NOT (
                "permissions" @> '[{"action":"manage","subject":"Installation"}]'::jsonb
             OR "permissions" @> '[{"action":"manage","subject":"all"}]'::jsonb
              )`,
    );

    // The rule changed for workspaces that already exist, so every cached
    // ability has to be rebuilt. This column is what keys that cache.
    await queryRunner.query(`UPDATE "organization" SET "roleVersion" = "roleVersion" + 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE rule <> '${RULE}'::jsonb
              ),
              "updatedAt" = now()
        WHERE "name" = 'owner'
          AND "organizationId" IS NULL`,
    );

    await queryRunner.query(`UPDATE "organization" SET "roleVersion" = "roleVersion" + 1`);
  }
}
