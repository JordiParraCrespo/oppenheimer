import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The version counters the authorization cache is keyed on.
 *
 * `AbilityFactory` caches a user's role-derived permissions in Redis under a
 * key that carries three counters, read together in one round trip on every
 * request. Every writer that changes what a role grants, or who holds it, bumps
 * the counter that covers it **in the same transaction as the write**, so the
 * next request reads a new version, builds a new key and misses: revocation is
 * visible at once, on every replica, with nothing to fan out and nothing that
 * can be lost between a commit and a cache delete.
 *
 * - `organization."roleVersion"` (already there, `AddOrgScopedRoles`) covers an
 *   organization's own roles and every assignment scoped to it.
 * - `role_catalog_version` covers the **global** role definitions (rows with
 *   `organizationId IS NULL`, which is where `owner` and `user` live, so almost
 *   every user's permissions come from here). One row: bumped on any create,
 *   edit or delete of a global role, and by any migration that edits one. It
 *   also tags the in-process snapshot of global roles each replica holds.
 * - `user_role_version` covers one user's **global** assignments (`user_role`
 *   rows with `organizationId IS NULL`), which apply in every organization and
 *   so are bumped per user rather than per organization. One row per user,
 *   keyed by the parent's id; a user with no row reads as version 0, so the
 *   table only grows with users whose global roles actually changed.
 *
 * Both tables are new and empty, so creating them locks nothing that matters;
 * `FK_user_role_version_user` briefly takes `SHARE ROW EXCLUSIVE` on `user`,
 * as every table referencing it has. The singleton is enforced by a `CHECK`
 * rather than trusted to the writers.
 */
export class AddAuthzVersions1790830000000 implements MigrationInterface {
  name = 'AddAuthzVersions1790830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "role_catalog_version" (
         "id" smallint NOT NULL DEFAULT 1,
         "version" bigint NOT NULL DEFAULT 1,
         CONSTRAINT "PK_role_catalog_version" PRIMARY KEY ("id"),
         CONSTRAINT "CHK_role_catalog_version_singleton" CHECK ("id" = 1)
       )`,
    );
    await queryRunner.query(
      `INSERT INTO "role_catalog_version" ("id", "version") VALUES (1, 1) ON CONFLICT DO NOTHING`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_role_version" (
         "userId" uuid NOT NULL,
         "version" bigint NOT NULL DEFAULT 1,
         CONSTRAINT "PK_user_role_version" PRIMARY KEY ("userId"),
         CONSTRAINT "FK_user_role_version_user" FOREIGN KEY ("userId")
           REFERENCES "user"("id") ON DELETE CASCADE
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_role_version"`);
    await queryRunner.query(`DROP TABLE "role_catalog_version"`);
  }
}
