import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets the default `user` role manage its own hosts.
 *
 * A host belongs to the person who paired it, so the grant belongs on the
 * person's role rather than on a workspace's — exactly as `ApiToken` already
 * does, and exactly as `SYSTEM_ROLE_PERMISSIONS.user` in
 * `@oppenheimer/shared` now says. That constant fixes a freshly seeded
 * database; this migration fixes the ones that already exist. Miss either and
 * every host route answers 403 for an ordinary account, which is invisible to
 * any test that stubs the ability.
 *
 * `manage` covers read, create, update and delete: minting a pairing token,
 * listing hosts, renaming one and unpairing one are all things a person does to
 * their own machines, and the condition is what keeps them off everyone else's.
 *
 * ## Why this appends rather than rewriting what it finds
 *
 * Roles are admin-managed at runtime (`PUT /roles/:id/permissions`), so the
 * `user` role in a live database is not necessarily the one the seed wrote. A
 * migration that replaced its `Host` rules would silently delete a narrowing an
 * administrator authored, and `down()` could not put it back. So the rule is
 * appended only where nothing already decides `Host` — a narrowed grant or a
 * deliberate `inverted` deny both count as decided and are left alone.
 *
 * The `roleVersion` bump is the other half. Role *rules* are cached keyed on
 * `organization.roleVersion`, so a database edit that nothing invalidates is an
 * edit that takes effect whenever a cache happens to expire.
 */
export class AddHostRolePermissions1788710000000 implements MigrationInterface {
  name = 'AddHostRolePermissions1788710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = "permissions" || '[{"action":"manage","subject":"Host","conditions":{"ownerUserId":"\${user.id}"}}]'::jsonb,
              "updatedAt" = now()
        WHERE "name" = 'user'
          AND "organizationId" IS NULL
          AND NOT (
                "permissions" @> '[{"subject":"Host"}]'::jsonb
             OR "permissions" @> '[{"action":"manage","subject":"all"}]'::jsonb
              )`,
    );

    // Cached abilities are keyed on this number, so without the bump a member of
    // an existing workspace keeps being refused until their cache lapses.
    await queryRunner.query(`UPDATE "organization" SET "roleVersion" = "roleVersion" + 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only the exact rule `up()` appended: a differently conditioned or inverted
    // `Host` rule belongs to whoever wrote it.
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE rule <> '{"action":"manage","subject":"Host","conditions":{"ownerUserId":"\${user.id}"}}'::jsonb
              ),
              "updatedAt" = now()
        WHERE "name" = 'user'
          AND "organizationId" IS NULL`,
    );

    await queryRunner.query(`UPDATE "organization" SET "roleVersion" = "roleVersion" + 1`);
  }
}
