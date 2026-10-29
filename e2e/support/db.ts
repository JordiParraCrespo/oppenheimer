import '@oppenheimer/env/load';
import { Pool } from 'pg';

/**
 * Direct database access for the tests: reset tokens are read from Better
 * Auth's `verification` table instead of a mail catcher.
 *
 * Connection settings are the root `.env`'s `DB_*` variables, the same ones
 * `database.config.ts` and Better Auth's pool read, so the suite asserts
 * against the API's own database. Blank is read as unset, matching
 * `orUndefined` in `apps/api/src/config/env.ts`, so a commented-out
 * `DB_PASSWORD=` behaves identically on both sides.
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
 * token for the user, expired or not: what the latest email carried.
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
  // A global assignment written behind the API's back: bump the user's role
  // version as `UserRoleRepository` would, or a cached role set keeps answering.
  await query(
    `INSERT INTO "user_role_version" ("userId", "version") VALUES ($1, 2)
     ON CONFLICT ("userId") DO UPDATE SET "version" = "user_role_version"."version" + 1`,
    [userId],
  );
}

/**
 * A bot's routine written straight into the tables (`26-bot-routines.md`):
 * a bot makes its routines through its own tool, in a turn of a real model,
 * so a spec about the Routines tab seeds one instead. A daily schedule at
 * 09:00 UTC, on. One statement, so the deferred revision key holds.
 */
export async function insertBotRoutine(
  botId: string,
  name: string,
  prompt: string,
): Promise<string> {
  const rows = await query<{ id: string }>(
    `WITH bot AS (SELECT "organizationId" FROM bot WHERE id = $1),
          owner AS (SELECT "userId" FROM member m JOIN bot ON m."organizationId" = bot."organizationId" LIMIT 1),
          ids AS (SELECT gen_random_uuid() AS automation, gen_random_uuid() AS revision),
          a AS (
            INSERT INTO automation (id, "organizationId", "projectId", "runTarget", "botId", "ownerUserId", name, "currentRevisionId")
            SELECT ids.automation, bot."organizationId", NULL, 'bot', $1, owner."userId", $2, ids.revision
              FROM bot, owner, ids
            RETURNING id
          ),
          r AS (
            INSERT INTO automation_revision (id, "organizationId", "automationId", number, permission, prompt, "createdByUserId")
            SELECT ids.revision, bot."organizationId", ids.automation, 1, 'auto', $3, owner."userId"
              FROM bot, owner, ids
          ),
          t AS (
            INSERT INTO automation_trigger ("organizationId", "automationId", position, source, "eventType", config, timezone, "nextFireAt")
            SELECT bot."organizationId", ids.automation, 0, 'schedule', 'schedule',
                   '{"frequency":"daily","hour":9,"minute":0}'::jsonb, 'UTC',
                   date_trunc('day', now()) + interval '1 day 9 hours'
              FROM bot, ids
          )
     SELECT id FROM a`,
    [botId, name, prompt],
  );
  return rows[0].id;
}

/**
 * A routine that wakes on new mail in one Gmail account (`next-steps/mail.md`
 * §5), seeded as `insertBotRoutine` seeds a schedule: a bot makes one through
 * its own tool and a real model. The account need not exist for the card.
 */
export async function insertBotMailRoutine(
  botId: string,
  name: string,
  connectionId: string,
  query: string | null,
): Promise<string> {
  const filter = query ? { op: 'equals', value: query } : { op: 'any' };
  const rows = await query<{ id: string }>(
    `WITH bot AS (SELECT "organizationId" FROM bot WHERE id = $1),
          owner AS (SELECT "userId" FROM member m JOIN bot ON m."organizationId" = bot."organizationId" LIMIT 1),
          ids AS (SELECT gen_random_uuid() AS automation, gen_random_uuid() AS revision, gen_random_uuid() AS trigger),
          a AS (
            INSERT INTO automation (id, "organizationId", "projectId", "runTarget", "botId", "ownerUserId", name, "currentRevisionId")
            SELECT ids.automation, bot."organizationId", NULL, 'bot', $1, owner."userId", $2, ids.revision
              FROM bot, owner, ids
            RETURNING id
          ),
          r AS (
            INSERT INTO automation_revision (id, "organizationId", "automationId", number, permission, prompt, "createdByUserId")
            SELECT ids.revision, bot."organizationId", ids.automation, 1, 'auto', 'Answer the mail.', owner."userId"
              FROM bot, owner, ids
          ),
          t AS (
            INSERT INTO automation_trigger (id, "organizationId", "automationId", position, source, "eventType", config)
            SELECT ids.trigger, bot."organizationId", ids.automation, 0, 'gmail', 'mail_received',
                   jsonb_build_object('connectionId', $3::text, 'filter', $4::jsonb)
              FROM bot, ids
          ),
          s AS (
            INSERT INTO automation_trigger_subject ("triggerId", "subjectKind", "subjectRef", "organizationId")
            SELECT ids.trigger, 'gmail_connection', $3, bot."organizationId"
              FROM bot, ids
          )
     SELECT id FROM a`,
    [botId, name, connectionId, JSON.stringify(filter)],
  );
  return rows[0].id;
}

export async function routinePausedAt(routineId: string): Promise<Date | null> {
  const rows = await query<{ pausedAt: Date | null }>(
    'SELECT "pausedAt" FROM automation WHERE id = $1',
    [routineId],
  );
  return rows[0]?.pausedAt ?? null;
}

/**
 * A bot's pending approval written straight into the tables (`25-bots.md`
 * §5): a bot raises one in a turn of a real model, so a spec about the Inbox
 * seeds the turn it stopped and the card it asks, with the call's stored
 * input when the card draws from it (a send card's message). One statement.
 */
export async function insertPendingBotApproval(
  botId: string,
  tool: string,
  summary: string,
  input: Record<string, unknown> = {},
): Promise<string> {
  const rows = await query<{ id: string }>(
    `WITH bot AS (SELECT "organizationId" FROM bot WHERE id = $1),
          turn AS (
            INSERT INTO bot_turn ("organizationId", "botId", status, provider, model)
            SELECT bot."organizationId", $1, 'completed', 'glm', 'glm-5'
              FROM bot
            RETURNING id, "organizationId"
          )
     INSERT INTO bot_approval ("organizationId", "botId", "turnId", tool, summary, input)
     SELECT turn."organizationId", $1, turn.id, $2, $3, $4::jsonb FROM turn
     RETURNING id`,
    [botId, tool, summary, JSON.stringify(input)],
  );
  return rows[0].id;
}

/**
 * A bot's turn that made tool calls, written straight into the tables
 * (`25-bots.md` §3): a finished turn and its activity line holding `steps`,
 * so a spec about what the chat draws under a call (a saved draft's card)
 * needs no model. One statement.
 */
export async function insertBotActivity(
  botId: string,
  steps: Record<string, unknown>[],
): Promise<void> {
  await query(
    `WITH bot AS (SELECT "organizationId" FROM bot WHERE id = $1),
          turn AS (
            INSERT INTO bot_turn ("organizationId", "botId", status, provider, model)
            SELECT bot."organizationId", $1, 'completed', 'glm', 'glm-5'
              FROM bot
            RETURNING id, "organizationId"
          )
     INSERT INTO bot_message ("organizationId", "botId", "turnId", role, steps, position)
     SELECT turn."organizationId", $1, turn.id, 'activity', $2::jsonb, 0 FROM turn`,
    [botId, JSON.stringify(steps)],
  );
}

/**
 * A send a bot scheduled from its owner's Gmail (`next-steps/mail.md` §3.4),
 * written straight into `mail_send` in the bot's workspace: the stack has no
 * Gmail to approve one against, and the list and its Cancel are the API's.
 */
export async function insertScheduledMail(
  botId: string,
  userId: string,
  subject: string,
  scheduledFor: Date,
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO mail_send ("organizationId", "userId", "botId", "approvalId", kind, "accountEmail",
                            recipients, subject, status, "scheduledFor", plan)
     SELECT bot."organizationId", $2, $1, gen_random_uuid(), 'new', 'ana@acme.test',
            ARRAY['Bo Ruiz <bo@client.test>'], $3, 'scheduled', $4, '{}'::jsonb
       FROM bot WHERE bot.id = $1
     RETURNING id`,
    [botId, userId, subject, scheduledFor],
  );
  return rows[0].id;
}
