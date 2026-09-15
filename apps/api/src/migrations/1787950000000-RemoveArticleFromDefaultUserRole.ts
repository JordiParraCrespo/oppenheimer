import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the `Article` grants from the default `user` role.
 *
 * `Article` has no resource declaration, no module and no table behind it — it
 * came from the boilerplate this codebase started from and was never revised
 * for this product. Two grants over something that does not exist made the
 * role look furnished while granting nothing real, which is worse than an
 * empty list: it hid that the role had never been looked at.
 *
 * Removing them changes no one's effective access, because nothing ever
 * checked `Article`. It makes the role say what it actually is: a plain
 * account holds only its own API tokens until an invitation grants it a role
 * for a workspace.
 *
 * Follows `TightenDefaultUserRole`, which removed the unconditional `User`
 * rules for the same reason — a default role should not carry grants nobody
 * decided to give it.
 */
export class RemoveArticleFromDefaultUserRole1787950000000 implements MigrationInterface {
  name = 'RemoveArticleFromDefaultUserRole1787950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE rule->>'subject' <> 'Article'
              ),
              "updatedAt" = now()
        WHERE "name" = 'user'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE rule->>'subject' <> 'Article'
              )
              || '[{"action":"read","subject":"Article"},
                    {"action":"create","subject":"Article"}]'::jsonb,
              "updatedAt" = now()
        WHERE "name" = 'user'`,
    );
  }
}
