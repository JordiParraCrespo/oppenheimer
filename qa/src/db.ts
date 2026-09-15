import pg from 'pg';

/**
 * A direct connection to the same database the API is using.
 *
 * The oracle. The only way to know whether a number on screen is *correct*
 * rather than merely present is to count the rows it claims to be counting;
 * reading it back through the API under test would be asking the same code the
 * same question twice.
 *
 * The credentials are the ones `@oppenheimer/env` puts in the environment from the
 * root `.env`, so the pack cannot end up asserting against a different database
 * from the one the API is writing to.
 */
export function qaPool(): pg.Pool {
  return new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'oppenheimer',
    password: process.env.DB_PASSWORD || 'oppenheimer',
    database: process.env.DB_DATABASE || 'oppenheimer',
  });
}

/** Run one query against a short-lived pool and close it again. */
export async function withDb<T>(fn: (pool: pg.Pool) => Promise<T>): Promise<T> {
  const pool = qaPool();
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

export interface OrganizationCounts {
  members: number;
  teams: number;
  pendingInvitations: number;
  apiTokens: number;
}

/**
 * What one workspace actually contains, counted the way the API counts it.
 *
 * Deliberately scoped by `organizationId` on every line: a count that forgets
 * the predicate passes against a single-tenant database and leaks on a real
 * one, which is exactly what AUTH-06 exists to catch.
 */
export async function organizationCounts(
  pool: pg.Pool,
  organizationId: string,
): Promise<OrganizationCounts> {
  const { rows } = await pool.query<Record<string, string>>(
    `SELECT
       (SELECT COUNT(DISTINCT "userId") FROM "member" WHERE "organizationId" = $1) AS members,
       (SELECT COUNT(*) FROM "team" WHERE "organizationId" = $1) AS teams,
       (SELECT COUNT(*) FROM "invitation"
         WHERE "organizationId" = $1 AND "status" = 'pending') AS pending_invitations,
       (SELECT COUNT(*) FROM "api_token" t
         JOIN "member" m ON m."userId" = t."userId"
        WHERE m."organizationId" = $1 AND t."revokedAt" IS NULL) AS api_tokens`,
    [organizationId],
  );
  const row = rows[0] ?? {};
  return {
    members: Number(row.members ?? 0),
    teams: Number(row.teams ?? 0),
    pendingInvitations: Number(row.pending_invitations ?? 0),
    apiTokens: Number(row.api_tokens ?? 0),
  };
}

export interface UserRow {
  id: string;
  email: string;
  role: string;
}

/** One account, by address. `undefined` when the pack never created it. */
export async function findUser(pool: pg.Pool, email: string): Promise<UserRow | undefined> {
  const { rows } = await pool.query<UserRow>(
    `SELECT "id", "email", "role" FROM "user" WHERE lower("email") = lower($1)`,
    [email],
  );
  return rows[0];
}

/** Live sessions for a user. The count is what a revocation check reads. */
export async function sessionsOf(pool: pg.Pool, userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "session" WHERE "userId" = $1`,
    [userId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** The organization roles a user holds, by organization. */
export async function membershipsOf(
  pool: pg.Pool,
  userId: string,
): Promise<Array<{ organizationId: string; role: string }>> {
  const { rows } = await pool.query<{ organizationId: string; role: string }>(
    `SELECT "organizationId", "role" FROM "member" WHERE "userId" = $1 ORDER BY "createdAt"`,
    [userId],
  );
  return rows;
}

/**
 * The application (CASL) roles a user holds.
 *
 * Separate from the membership role on purpose: `applicationRoleFor` maps one
 * to the other, and the CRM pack found the two disagreeing after an invitation.
 * A scenario that reads only one of them cannot see that.
 */
export async function applicationRolesOf(pool: pg.Pool, userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ name: string }>(
    `SELECT r."name" FROM "user_role" ur
       JOIN "role" r ON r."id" = ur."roleId"
      WHERE ur."userId" = $1
      ORDER BY r."name"`,
    [userId],
  );
  return rows.map((row) => row.name);
}
