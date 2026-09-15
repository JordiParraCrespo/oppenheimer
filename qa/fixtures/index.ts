import type pg from 'pg';
import { withDb } from '../src/db.js';
import { loadPack } from '../src/scenarios.js';
import {
  FIXTURE_ACCOUNTS,
  type FixtureAccount,
  type FixtureName,
  ROSTER_CAST,
  TRANSIENT_ACCOUNTS,
} from './accounts.js';
import { seedInvitations, seedMembers, seedTeams } from './seed.js';

const API_URL = process.env.QA_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.QA_WEB_URL ?? 'http://localhost:3000';

export interface AppliedFixture {
  name: FixtureName;
  account: FixtureAccount;
  organizationId: string;
  counts: { members: number; teams: number; pendingInvitations: number };
  elapsedMs: number;
}

/**
 * Everything sign-up needs. Narrower than `FixtureAccount` so the roster cast,
 * which owns no workspace of its own, can go through the same door — and a
 * credential the sign-in endpoint accepts is the whole point of that door.
 */
type Credentialed = Pick<FixtureAccount, 'email' | 'password' | 'firstName' | 'lastName'>;

interface Session {
  cookie: string;
  userId: string;
}

/**
 * Better Auth refuses a cookie-bearing state change that arrives without an
 * `Origin` — its CSRF defence. Browsers always send one; a server-side caller
 * has to supply it, and the web app's URL is the one in `trustedOrigins`.
 */
const ORIGIN_HEADERS = { 'Content-Type': 'application/json', Origin: WEB_URL };

function sessionCookie(response: Response): string {
  const raw = response.headers.getSetCookie?.() ?? [];
  return raw.map((value) => value.split(';')[0]).join('; ');
}

/**
 * Creates the account if it is not there yet, and signs it in either way.
 *
 * Sign-up goes through the real HTTP endpoint rather than a direct insert, so
 * the password is hashed the way the sign-in endpoint will later verify it —
 * a fixture that writes its own hash produces accounts nobody can log into.
 */
async function ensureAccount(pool: pg.Pool, account: Credentialed): Promise<Session> {
  const existing = await pool.query<{ id: string }>(
    `SELECT "id" FROM "user" WHERE lower("email") = lower($1)`,
    [account.email],
  );

  if (!existing.rows[0]) {
    const response = await fetch(`${API_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: ORIGIN_HEADERS,
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        name: `${account.firstName} ${account.lastName}`,
        firstName: account.firstName,
        lastName: account.lastName,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `could not create ${account.email}: HTTP ${response.status} ${await response.text()}`,
      );
    }
  }

  const signIn = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: ORIGIN_HEADERS,
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (!signIn.ok) {
    throw new Error(
      `could not sign in as ${account.email}: HTTP ${signIn.status} ${await signIn.text()}`,
    );
  }

  // Sign-up runs after-hooks it does not await (the welcome email, the default
  // role), so give the row a moment to land before reading it back.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const created = await pool.query<{ id: string }>(
      `SELECT "id" FROM "user" WHERE lower("email") = lower($1)`,
      [account.email],
    );
    if (created.rows[0]) return { cookie: sessionCookie(signIn), userId: created.rows[0].id };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${account.email} was created but never appeared in the database`);
}

/**
 * The workspace, created through `POST /v1/organizations`.
 *
 * Deliberately the product's own door rather than an INSERT. Creating an
 * organization is what grants the creator the org-scoped `owner` role, and that
 * role is narrowed to the active organization by design — a fixture that wrote
 * the rows itself would produce an owner with no ability at all, or would have
 * to invent one and measure the pack's fiction instead of the product.
 *
 * `user.role` stays `user` throughout: `admin`/`superadmin` there is a platform
 * identity that bypasses tenant scoping, and an owner holding it would read
 * every workspace's rows, so AUTH-06 would be green whatever the product did.
 */
async function ensureWorkspace(
  pool: pg.Pool,
  session: Session,
  name: string,
): Promise<{ organizationId: string; preExisting: boolean }> {
  const mine = await pool.query<{ organizationId: string }>(
    `SELECT m."organizationId" FROM "member" m
       JOIN "organization" o ON o."id" = m."organizationId"
      WHERE m."userId" = $1 AND o."name" = $2
      LIMIT 1`,
    [session.userId, name],
  );
  if (mine.rows[0]) return { organizationId: mine.rows[0].organizationId, preExisting: true };

  const response = await fetch(`${API_URL}/api/v1/organizations`, {
    method: 'POST',
    headers: { ...ORIGIN_HEADERS, Cookie: session.cookie },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(
      `could not create the workspace "${name}": HTTP ${response.status} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { id: string };
  return { organizationId: body.id, preExisting: false };
}

/**
 * Empties a workspace of everything a fixture put in it, keeping the workspace
 * and its owner.
 *
 * Rebuild rather than top up: a rerun after an interrupted attempt has to start
 * where a first run does, or the second run's counts are the first run's plus
 * whatever it managed before it died — and every oracle in the pack would then
 * be comparing the screen against a number nobody intended.
 */
async function emptyWorkspace(
  pool: pg.Pool,
  organizationId: string,
  ownerId: string,
): Promise<void> {
  await pool.query(`DELETE FROM "invitation" WHERE "organizationId" = $1`, [organizationId]);
  await pool.query(
    `DELETE FROM "teamMember" WHERE "teamId" IN (SELECT "id" FROM "team" WHERE "organizationId" = $1)`,
    [organizationId],
  );
  await pool.query(`DELETE FROM "team" WHERE "organizationId" = $1`, [organizationId]);
  // The seeded roster-only accounts exist for this workspace and nothing else,
  // so they go with it. The owner stays: they hold the credential.
  await pool.query(
    `DELETE FROM "user" WHERE "id" IN (
       SELECT "userId" FROM "member" WHERE "organizationId" = $1 AND "userId" <> $2
     ) AND lower("email") LIKE 'member%@qa.oppenheimer.dev'`,
    [organizationId, ownerId],
  );
  await pool.query(`DELETE FROM "member" WHERE "organizationId" = $1 AND "userId" <> $2`, [
    organizationId,
    ownerId,
  ]);
}

/** Puts one roster member in the workspace at a known organization and platform role. */
async function seedRoster(pool: pg.Pool, organizationId: string): Promise<void> {
  for (const person of ROSTER_CAST) {
    const session = await ensureAccount(pool, person);
    await pool.query(`UPDATE "user" SET "role" = $2 WHERE "id" = $1`, [
      session.userId,
      person.platformRole,
    ]);
    await pool.query(
      `INSERT INTO "member" ("id", "organizationId", "userId", "role", "createdAt")
       SELECT gen_random_uuid(), $1, $2, $3, now()
        WHERE NOT EXISTS (
          SELECT 1 FROM "member" WHERE "organizationId" = $1 AND "userId" = $2
        )`,
      [organizationId, session.userId, person.organizationRole],
    );
    await pool.query(
      `UPDATE "member" SET "role" = $3 WHERE "organizationId" = $1 AND "userId" = $2`,
      [organizationId, session.userId, person.organizationRole],
    );
  }
}

/**
 * Deletes the accounts the auth scenarios mint, so they can mint them again.
 *
 * Deliberately leaves the fixture workspaces alone: they own their own data and
 * rebuild themselves, and an auth scenario emptying them would leave whichever
 * scenario ran next reading a database somebody else had cleared.
 */
async function resetTransientAccounts(pool: pg.Pool): Promise<void> {
  const emails = [...TRANSIENT_ACCOUNTS];
  const { rows } = await pool.query<{ id: string }>(
    `SELECT "id" FROM "user" WHERE lower("email") = ANY($1::text[])`,
    [emails.map((email) => email.toLowerCase())],
  );
  const ids = rows.map((row) => row.id);
  // Invitations addressed to them are part of the state they must be able to
  // re-enter: a pending invitation left behind makes the second run's "invite
  // this person" a duplicate rather than an invitation.
  await pool.query(`DELETE FROM "invitation" WHERE lower("email") = ANY($1::text[])`, [
    emails.map((email) => email.toLowerCase()),
  ]);
  if (ids.length === 0) return;

  await pool.query(
    `DELETE FROM "organization" WHERE "id" IN (
       SELECT "organizationId" FROM "member" WHERE "userId" = ANY($1::uuid[])
     ) AND "id" NOT IN (
       SELECT "organizationId" FROM "member" WHERE "userId" <> ALL($1::uuid[])
     )`,
    [ids],
  );
  for (const table of ['session', 'account', 'member', 'user_role', 'api_token']) {
    await pool.query(`DELETE FROM "${table}" WHERE "userId" = ANY($1::uuid[])`, [ids]);
  }
  await pool.query(`DELETE FROM "verification" WHERE "identifier" ILIKE ANY($1::text[])`, [
    emails.map((email) => `%${email}%`),
  ]);
  await pool.query(`DELETE FROM "user" WHERE "id" = ANY($1::uuid[])`, [ids]);
}

/**
 * Puts the database into a named state.
 *
 * Idempotent by construction: every fixture tears its own workspace down and
 * rebuilds it, so applying twice costs time and changes nothing else.
 */
export async function applyFixture(name: FixtureName): Promise<AppliedFixture | null> {
  const startedAt = Date.now();
  const pack = loadPack();
  const spec = pack.fixtures[name];
  if (!spec) throw new Error(`unknown fixture "${name}" — add it to qa/scenarios/index.yaml`);

  return withDb(async (pool) => {
    // `reset` is the one fixture that owns no workspace: it exists so the
    // transient accounts can be created again.
    await resetTransientAccounts(pool);
    if (name === 'reset') return null;

    const account = FIXTURE_ACCOUNTS[name];
    const session = await ensureAccount(pool, account);
    await pool.query(`UPDATE "user" SET "role" = 'user' WHERE "id" = $1`, [session.userId]);
    const { organizationId } = await ensureWorkspace(pool, session, account.organizationName);
    await emptyWorkspace(pool, organizationId, session.userId);

    const volume = spec.volume ?? {};
    if (spec.seeds.includes('members')) {
      await seedMembers(pool, organizationId, Math.max(0, (volume.members ?? 1) - 1));
    }
    if (spec.seeds.includes('teams')) await seedTeams(pool, organizationId, volume.teams ?? 0);
    if (spec.seeds.includes('invitations')) {
      await seedInvitations(pool, organizationId, session.userId, volume.invitations ?? 0);
    }
    if (spec.seeds.includes('roster')) await seedRoster(pool, organizationId);

    const { rows } = await pool.query<Record<string, string>>(
      `SELECT
         (SELECT COUNT(*) FROM "member" WHERE "organizationId" = $1) AS members,
         (SELECT COUNT(*) FROM "team" WHERE "organizationId" = $1) AS teams,
         (SELECT COUNT(*) FROM "invitation"
           WHERE "organizationId" = $1 AND "status" = 'pending') AS invitations`,
      [organizationId],
    );

    return {
      name,
      account,
      organizationId,
      counts: {
        members: Number(rows[0]?.members ?? 0),
        teams: Number(rows[0]?.teams ?? 0),
        pendingInvitations: Number(rows[0]?.invitations ?? 0),
      },
      elapsedMs: Date.now() - startedAt,
    };
  });
}

export { FIXTURE_ACCOUNTS, ROSTER_CAST, TRANSIENT_ACCOUNTS };
