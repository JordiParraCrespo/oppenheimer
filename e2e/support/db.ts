import '@oppenheimer/env/load';
import { Pool } from 'pg';

/**
 * Direct database access for the tests.
 *
 * Password-reset and verification tokens normally reach a user by email. Rather
 * than standing up a mail catcher, the suite reads them from where the API puts
 * them: reset tokens live in Better Auth's `verification` table, and everything
 * else is asserted against the rows sign-up is supposed to create.
 *
 * Connection settings come from the root `.env` through `@oppenheimer/env`, reading
 * the same `DB_*` variables as `database.config.ts` and Better Auth's own pool.
 * That is the whole point: a suite that asserted against a *different* database
 * from the API under test would report passes that mean nothing. Blank is read
 * as unset, matching `orUndefined` in `apps/api/src/config/env.ts`, so a
 * commented-out `DB_PASSWORD=` behaves identically on both sides.
 */
const orUndefined = (value: string | undefined): string | undefined =>
  value?.trim() ? value : undefined;

const pool = new Pool({
  host: orUndefined(process.env.DB_HOST) ?? 'localhost',
  port: Number.parseInt(orUndefined(process.env.DB_PORT) ?? '5432', 10),
  user: orUndefined(process.env.DB_USERNAME) ?? 'oppenheimer',
  password: orUndefined(process.env.DB_PASSWORD) ?? 'oppenheimer',
  database: orUndefined(process.env.DB_DATABASE) ?? 'oppenheimer',
  max: 5,
  // Test files inside one worker share this module, so no single file may own
  // the pool's lifetime — an `end()` in one file's afterAll would break every
  // other file still running in that worker. Releasing idle clients instead
  // lets the worker exit on its own.
  allowExitOnIdle: true,
});

export async function query<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool.query<T>(sql, params);
  return rows;
}

export type UserRow = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  banned: boolean | null;
  isActive: boolean | null;
};

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const rows = await query<UserRow>('SELECT * FROM "user" WHERE lower("email") = lower($1)', [
    email,
  ]);
  return rows[0];
}

/**
 * The reset token as Better Auth stores it: the `verification` row's identifier
 * is `reset-password:<token>` and its value is the user id. Returns the newest
 * unexpired token for the user, which is what the email would have carried.
 */
export async function findResetToken(email: string): Promise<string | undefined> {
  const rows = await query<{ identifier: string }>(
    `SELECT v."identifier"
       FROM "verification" v
       JOIN "user" u ON u."id"::text = v."value"
      WHERE lower(u."email") = lower($1)
        AND v."identifier" LIKE 'reset-password:%'
      ORDER BY v."createdAt" DESC
      LIMIT 1`,
    [email],
  );
  const identifier = rows[0]?.identifier;
  return identifier ? identifier.slice('reset-password:'.length) : undefined;
}

export async function countResetTokens(email: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM "verification" v
       JOIN "user" u ON u."id"::text = v."value"
      WHERE lower(u."email") = lower($1)
        AND v."identifier" LIKE 'reset-password:%'`,
    [email],
  );
  return Number(rows[0]?.count ?? '0');
}

/** Force a token to look expired without waiting out its real lifetime. */
export async function expireResetToken(token: string): Promise<void> {
  await query(
    `UPDATE "verification" SET "expiresAt" = now() - interval '1 hour' WHERE "identifier" = $1`,
    [`reset-password:${token}`],
  );
}

export async function findSessionsForUser(userId: string): Promise<{ id: string }[]> {
  return query<{ id: string }>('SELECT "id" FROM "session" WHERE "userId" = $1', [userId]);
}

/** The RBAC roles actually attached to a user through the `user_role` join. */
export async function findRoleNames(userId: string): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `SELECT r."name" FROM "user_role" ur JOIN "role" r ON r."id" = ur."roleId" WHERE ur."userId" = $1`,
    [userId],
  );
  return rows.map((row) => row.name);
}

export async function findOrganizationsForUser(
  userId: string,
): Promise<{ organizationId: string; role: string; orgName: string }[]> {
  return query<{ organizationId: string; role: string; orgName: string }>(
    `SELECT m."organizationId", m."role", o."name" AS "orgName"
       FROM "member" m JOIN "organization" o ON o."id" = m."organizationId"
      WHERE m."userId" = $1`,
    [userId],
  );
}

export async function findTeamsForUser(userId: string): Promise<{ name: string }[]> {
  return query<{ name: string }>(
    `SELECT t."name" FROM "teamMember" tm JOIN "team" t ON t."id" = tm."teamId" WHERE tm."userId" = $1`,
    [userId],
  );
}

/** Password hash, so tests can prove a reset actually changed the credential. */
export async function findPasswordHash(userId: string): Promise<string | undefined> {
  const rows = await query<{ password: string | null }>(
    `SELECT "password" FROM "account" WHERE "userId" = $1 AND "providerId" = 'credential'`,
    [userId],
  );
  return rows[0]?.password ?? undefined;
}

export async function setUserRole(userId: string, role: string): Promise<void> {
  await query('UPDATE "user" SET "role" = $1 WHERE "id" = $2', [role, userId]);
  await query(
    `INSERT INTO "user_role" ("userId", "roleId")
       SELECT $1, r."id" FROM "role" r WHERE r."name" = $2
       ON CONFLICT DO NOTHING`,
    [userId, role],
  );
}
