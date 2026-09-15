import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the two platform-wide User grants inherited from the original
 * boilerplate role. A standard user has dedicated self-service profile routes;
 * organization colleagues come from the Member resource. Keeping these
 * unconditional rules would let every regular account list and edit every
 * platform account across tenant boundaries.
 *
 * Conditional User rules are preserved so an installation that deliberately
 * added an own-resource policy does not lose it.
 */
export class TightenDefaultUserRole1787600000000 implements MigrationInterface {
  name = 'TightenDefaultUserRole1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE NOT (rule->>'subject' = 'User'
                            AND rule->>'action' IN ('read', 'update')
                            AND NOT (rule ? 'conditions'))
              )
        WHERE "name" = 'user'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE NOT (rule->>'subject' = 'User'
                            AND rule->>'action' IN ('read', 'update')
                            AND NOT (rule ? 'conditions'))
              )
              || '[{"action":"read","subject":"User"},
                    {"action":"update","subject":"User"}]'::jsonb
        WHERE "name" = 'user'`,
    );
  }
}
