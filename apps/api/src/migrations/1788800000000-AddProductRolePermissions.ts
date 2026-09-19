import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives the seeded system roles the control plane's own subjects.
 *
 * These mirror `SYSTEM_ROLE_PERMISSIONS` in `@oppenheimer/shared`: a workspace's
 * `owner` manages the workspace-owned resources, narrowed by
 * `${activeOrganizationId}`, and the default `user` role manages its own hosts,
 * narrowed by `${user.id}`. A host belongs to the **person** who paired it and
 * workspaces borrow it, which is why it sits on the person's role exactly as
 * `ApiToken` does (`product/versions/mvp/03-control-plane.md`).
 *
 * There is no `Repository` rule, because there is no repository row: the GitHub
 * App installation is the boundary and GitHub answers it, so the listing routes
 * sit on `read Installation` — the access they are about to exercise.
 *
 * Appends only, and only where nothing already decides the subject: an
 * administrator who narrowed or inverted one of these rules keeps their version,
 * and `down()` removes exactly the rules added here. Same discipline as
 * `LetDefaultUserCreateWorkspaces` (1788400000000).
 *
 * It is also the first migration in the repository to bump
 * `organization.roleVersion`, because it is the first to change a role's rules
 * for workspaces that already exist: that column is the cache key for a tenant's
 * abilities, so without the bump every existing workspace would keep being
 * refused by the routes this opens until something else invalidated it.
 */

const ACTIVE_ORGANIZATION = '{"organizationId":"${activeOrganizationId}"}';
const OWN_USER = '{"ownerUserId":"${user.id}"}';

/** Which role gets which rule, as the shared constant states it. */
const RULES: { role: string; globalOnly: boolean; subject: string; conditions: string }[] = [
  { role: 'owner', globalOnly: true, subject: 'Project', conditions: ACTIVE_ORGANIZATION },
  { role: 'owner', globalOnly: true, subject: 'Session', conditions: ACTIVE_ORGANIZATION },
  { role: 'owner', globalOnly: true, subject: 'Installation', conditions: ACTIVE_ORGANIZATION },
  { role: 'user', globalOnly: false, subject: 'Host', conditions: OWN_USER },
];

function rule(subject: string, conditions: string): string {
  return `{"action":"manage","subject":"${subject}","conditions":${conditions}}`;
}

export class AddProductRolePermissions1788800000000 implements MigrationInterface {
  name = 'AddProductRolePermissions1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { role, globalOnly, subject, conditions } of RULES) {
      await queryRunner.query(
        `UPDATE "role"
            SET "permissions" = "permissions" || '[${rule(subject, conditions)}]'::jsonb,
                "updatedAt" = now()
          WHERE "name" = '${role}'
            ${globalOnly ? 'AND "organizationId" IS NULL' : ''}
            AND NOT (
                  "permissions" @> '[{"action":"manage","subject":"${subject}"}]'::jsonb
               OR "permissions" @> '[{"action":"manage","subject":"all"}]'::jsonb
                )`,
      );
    }

    // The rules changed for workspaces that already exist, so every cached
    // ability has to be rebuilt. This column is what keys that cache.
    await queryRunner.query(`UPDATE "organization" SET "roleVersion" = "roleVersion" + 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { role, globalOnly, subject, conditions } of RULES) {
      await queryRunner.query(
        `UPDATE "role"
            SET "permissions" = (
                  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb)
                    FROM jsonb_array_elements("permissions") AS r
                   WHERE r <> '${rule(subject, conditions)}'::jsonb
                ),
                "updatedAt" = now()
          WHERE "name" = '${role}'
            ${globalOnly ? 'AND "organizationId" IS NULL' : ''}`,
      );
    }

    await queryRunner.query(`UPDATE "organization" SET "roleVersion" = "roleVersion" + 1`);
  }
}
