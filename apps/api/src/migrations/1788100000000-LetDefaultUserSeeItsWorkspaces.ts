import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets the default `user` role see which workspaces it belongs to.
 *
 * Sign-up no longer provisions an organization: an account belongs nowhere
 * until an invitation puts it in a workspace. The app therefore has to be able
 * to ask "does this account belong anywhere yet?" — that is the whole of this
 * grant, and Better Auth answers it from the caller's own memberships, so it
 * discloses no workspace they are not in.
 *
 * `create` is granted separately, by `LetDefaultUserCreateWorkspaces`
 * (1788400000000): this boilerplate is self-service, so a fresh account makes
 * its first workspace from onboarding. This migration only ever touches the
 * `read` rule.
 *
 * ## Why this does not rewrite whatever it finds
 *
 * Roles are admin-managed at runtime (`PUT /roles/:id/permissions`), so the
 * `user` role in a live database is not necessarily the one the seed wrote. A
 * migration that stripped every `Organization` rule and appended an
 * unconditional grant would silently delete an administrator's tenant
 * restriction or `inverted` deny and widen every plain user's access — and
 * `down()` could not put it back, because the rule it replaced is gone.
 *
 * So: append only when the role carries no `read` (or `manage`) rule for
 * `Organization` at all. Anything an administrator authored — conditions,
 * fields, `inverted` — is left alone.
 */
export class LetDefaultUserSeeItsWorkspaces1788100000000 implements MigrationInterface {
  name = 'LetDefaultUserSeeItsWorkspaces1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Append the read only where nothing already answers it. Containment
    // matches a rule that carries extra keys, so a narrowed grant
    // (`conditions`) and a deliberate `inverted` deny both count as "already
    // decided" and are left exactly as their author left them.
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = "permissions" || '[{"action":"read","subject":"Organization"}]'::jsonb,
              "updatedAt" = now()
        WHERE "name" = 'user'
          AND NOT (
                "permissions" @> '[{"action":"read","subject":"Organization"}]'::jsonb
             OR "permissions" @> '[{"action":"manage","subject":"Organization"}]'::jsonb
             OR "permissions" @> '[{"action":"read","subject":"all"}]'::jsonb
             OR "permissions" @> '[{"action":"manage","subject":"all"}]'::jsonb
              )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only the exact rule `up()` appended, for the same reason: a narrowed or
    // inverted `read Organization` rule belongs to whoever wrote it.
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE rule <> '{"action":"read","subject":"Organization"}'::jsonb
              ),
              "updatedAt" = now()
        WHERE "name" = 'user'`,
    );
  }
}
