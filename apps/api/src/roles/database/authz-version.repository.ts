import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthzVersionRepositoryPort, AuthzVersions } from './authz-version.repository.port';

/** Anything that can run SQL: a `DataSource`, or a transaction's `EntityManager`. */
interface Queryable {
  query: (sql: string, parameters?: unknown[]) => Promise<unknown>;
}

/**
 * The bump helpers below are the other half: every writer that changes
 * effective permissions calls one with **its own transaction's manager**.
 * Routing invalidation through the outbox or a Redis counter bumped after
 * commit would be eventually consistent (`OutboxService.wake()` swallows
 * delivery failures; a process can die between commit and delete), and
 * permission revocation is exactly the case that cannot tolerate that.
 */
@Injectable()
export class AuthzVersionRepository implements AuthzVersionRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async read(userId: string | null, organizationId: string | null): Promise<AuthzVersions> {
    const rows = (await this.dataSource.query(
      `SELECT
         (SELECT "roleVersion"::text FROM "organization" WHERE "id" = $2::uuid) AS "organization",
         (SELECT "version"::text FROM "role_catalog_version" WHERE "id" = 1) AS "catalog",
         (SELECT "version"::text FROM "user_role_version" WHERE "userId" = $1::uuid) AS "user"`,
      [userId, organizationId],
    )) as { organization: string | null; catalog: string | null; user: string | null }[];
    const [row] = rows;
    return {
      organization: row?.organization ?? null,
      catalog: row?.catalog ?? '0',
      user: row?.user ?? '0',
    };
  }
}

/**
 * Invalidate every cached permission set in an organization: its own roles
 * changed, or an assignment scoped to it did.
 */
export async function bumpRoleVersion(manager: Queryable, organizationId: string): Promise<void> {
  await manager.query(
    'UPDATE "organization" SET "roleVersion" = "roleVersion" + 1 WHERE "id" = $1',
    [organizationId],
  );
}

/**
 * Invalidate every cached permission set that includes a global role, which
 * is nearly all of them (`owner` and `user` are global rows), and every
 * replica's snapshot of the global roles.
 */
export async function bumpRoleCatalogVersion(manager: Queryable): Promise<void> {
  await manager.query('UPDATE "role_catalog_version" SET "version" = "version" + 1 WHERE "id" = 1');
}

/** Invalidate one user's cached permission sets, in every organization. */
export async function bumpUserRoleVersion(manager: Queryable, userId: string): Promise<void> {
  await manager.query(
    `INSERT INTO "user_role_version" ("userId", "version") VALUES ($1, 2)
     ON CONFLICT ("userId") DO UPDATE SET "version" = "user_role_version"."version" + 1`,
    [userId],
  );
}

/**
 * Bump whichever counters cover a role whose definition changed. Call it before a
 * delete: it reads the role's assignments, which the delete cascades away.
 *
 * - A global role: the catalog, which every cache key carries.
 * - An organization's role: that organization, plus every user who holds it outside it
 *   (a global assignment, since `PUT /users/:id/roles` with no tenant resolves role ids
 *   unscoped, or one scoped elsewhere): their keys carry another organization's
 *   version, so bumping the owner's alone would leave them holding the old rules.
 */
export async function bumpForRole(
  manager: Queryable,
  role: { id: string; organizationId: string | null },
): Promise<void> {
  if (role.organizationId === null) {
    await bumpRoleCatalogVersion(manager);
    return;
  }
  await bumpRoleVersion(manager, role.organizationId);
  await manager.query(
    `INSERT INTO "user_role_version" ("userId", "version")
       SELECT DISTINCT "userId", 2 FROM "user_role"
        WHERE "roleId" = $1
          AND ("organizationId" IS NULL OR "organizationId" <> $2)
     ON CONFLICT ("userId") DO UPDATE SET "version" = "user_role_version"."version" + 1`,
    [role.id, role.organizationId],
  );
}

/** Bump the counter that covers an assignment in `organizationId` (`null`: global). */
export async function bumpForAssignment(
  manager: Queryable,
  userId: string,
  organizationId: string | null,
): Promise<void> {
  if (organizationId) await bumpRoleVersion(manager, organizationId);
  else await bumpUserRoleVersion(manager, userId);
}
