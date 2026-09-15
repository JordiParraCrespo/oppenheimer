import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets the default `user` role create an organization.
 *
 * Sign-up provisions nothing, so a freshly registered account has to be able
 * to make its first workspace from onboarding — `POST /v1/organizations`
 * answered 403 for it otherwise. `OrganizationsService.create` grants the
 * creator the org-scoped `admin` role in the same act, so the grant opens
 * exactly the workspace the account made and nothing else.
 *
 * Runs after `LetDefaultUserSeeItsWorkspaces` (1788100000000), which used to
 * strip an unconditional `create Organization` rule; that stripping was
 * removed so the two cannot fight over the same rule. Same discipline as that
 * migration: append only where nothing already decides `create`, and `down()`
 * removes only the exact rule appended here, so an administrator's narrowed or
 * inverted rule is never touched.
 */
export class LetDefaultUserCreateWorkspaces1788400000000 implements MigrationInterface {
  name = 'LetDefaultUserCreateWorkspaces1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = "permissions" || '[{"action":"create","subject":"Organization"}]'::jsonb,
              "updatedAt" = now()
        WHERE "name" = 'user'
          AND NOT (
                "permissions" @> '[{"action":"create","subject":"Organization"}]'::jsonb
             OR "permissions" @> '[{"action":"manage","subject":"Organization"}]'::jsonb
             OR "permissions" @> '[{"action":"create","subject":"all"}]'::jsonb
             OR "permissions" @> '[{"action":"manage","subject":"all"}]'::jsonb
              )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE rule <> '{"action":"create","subject":"Organization"}'::jsonb
              ),
              "updatedAt" = now()
        WHERE "name" = 'user'`,
    );
  }
}
