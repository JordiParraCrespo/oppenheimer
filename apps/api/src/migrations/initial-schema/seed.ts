import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLES } from '@oppenheimer/shared';
import type { QueryRunner } from 'typeorm';

/** What the role list shows for each system role; the permissions come from the catalog. */
const DESCRIPTIONS: Record<(typeof SYSTEM_ROLES)[number], string> = {
  superadmin: 'Platform super administrator (admin plugin: ban, impersonate, manage users).',
  admin: 'Full access to everything.',
  owner: 'Administers the organization it is granted in.',
  user: 'Standard authenticated user.',
};

/**
 * The global system roles, from `SYSTEM_ROLE_PERMISSIONS`, and the singleton
 * `role_catalog_version` row the authorization cache reads. A later change to
 * the catalog is a new migration that updates these rows and bumps the version.
 */
export async function seedSystemRoles(queryRunner: QueryRunner): Promise<void> {
  for (const name of SYSTEM_ROLES) {
    await queryRunner.query(
      `INSERT INTO "role" ("id", "name", "description", "isSystem", "organizationId", "permissions")
       VALUES (gen_random_uuid(), $1, $2, true, NULL, $3::jsonb)`,
      [name, DESCRIPTIONS[name], JSON.stringify(SYSTEM_ROLE_PERMISSIONS[name])],
    );
  }
  await queryRunner.query(`INSERT INTO "role_catalog_version" ("id", "version") VALUES (1, 1)`);
}
