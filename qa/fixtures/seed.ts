import type pg from 'pg';

/**
 * Deterministic content for the seeded rows.
 *
 * Fixed lists rather than a random generator: a screenshot is evidence, and
 * evidence that shows different names every run is much harder to compare
 * against the last one. The only thing that varies between fixtures is how many
 * rows are asked for.
 */
const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Marc', 'Nuria', 'Pau'];
const LAST_NAMES = ['Garcia', 'Lopez', 'Martin', 'Ruiz', 'Sanz', 'Vidal'];
const TEAM_NAMES = [
  'General',
  'Platform',
  'Growth',
  'Support',
  'Design',
  'Data',
  'Security',
  'Mobile',
];

/**
 * Extra people on the roster, so the member count counts something real.
 *
 * Roster-only accounts: they exist to be counted and listed, never to sign in,
 * so they are written straight to `user` with no credential account. Anything
 * that must authenticate goes through Better Auth instead — the only thing that
 * hashes a password the way the sign-in endpoint expects.
 */
export async function seedMembers(
  pool: pg.Pool,
  organizationId: string,
  count: number,
): Promise<void> {
  if (count <= 0) return;
  const slug = organizationId.replace(/-/g, '').slice(0, 8);
  await pool.query(
    `WITH new_users AS (
       INSERT INTO "user" ("id", "name", "email", "emailVerified", "firstName", "lastName", "role")
       SELECT
         gen_random_uuid(),
         first || ' ' || last,
         'member' || i || '.' || $2 || '@qa.oppenheimer.dev',
         true,
         first,
         last,
         'user'
       FROM generate_series(1, $3::int) AS i
       CROSS JOIN LATERAL (
         SELECT
           ($4::text[])[1 + (i % array_length($4::text[], 1))] AS first,
           ($5::text[])[1 + (i % array_length($5::text[], 1))] AS last
       ) AS names
       ON CONFLICT ("email") DO NOTHING
       RETURNING "id"
     )
     INSERT INTO "member" ("id", "organizationId", "userId", "role", "createdAt")
     SELECT gen_random_uuid(), $1, "id", 'member', now() FROM new_users`,
    [organizationId, slug, count, FIRST_NAMES, LAST_NAMES],
  );
}

/** Teams inside the workspace. The first is the one onboarding would create. */
export async function seedTeams(
  pool: pg.Pool,
  organizationId: string,
  count: number,
): Promise<void> {
  if (count <= 0) return;
  await pool.query(
    `INSERT INTO "team" ("id", "name", "organizationId", "createdAt")
     SELECT
       gen_random_uuid(),
       CASE
         WHEN i <= array_length($3::text[], 1) THEN ($3::text[])[i]
         ELSE 'Team ' || i
       END,
       $1,
       now()
     FROM generate_series(1, $2::int) AS i`,
    [organizationId, count, TEAM_NAMES],
  );
}

/**
 * Invitations that were sent and never answered.
 *
 * Pending on purpose: an accepted invitation is a member, and the number a
 * screen puts beside "pending" is the one most likely to be counting every
 * invitation ever sent instead.
 */
export async function seedInvitations(
  pool: pg.Pool,
  organizationId: string,
  inviterId: string,
  count: number,
): Promise<void> {
  if (count <= 0) return;
  // The workspace id appears twice — once as a uuid column and once inside the
  // generated address — and Postgres refuses to deduce two types for one
  // parameter, so the address half is passed separately as text.
  const slug = organizationId.replace(/-/g, '').slice(0, 8);
  await pool.query(
    `INSERT INTO "invitation"
       ("id", "organizationId", "email", "role", "status", "inviterId", "expiresAt")
     SELECT
       gen_random_uuid(),
       $1::uuid,
       'pending' || i || '.' || $4 || '@qa.oppenheimer.dev',
       CASE WHEN i % 3 = 0 THEN 'admin' ELSE 'member' END,
       'pending',
       $3,
       now() + interval '7 days'
     FROM generate_series(1, $2::int) AS i`,
    [organizationId, count, inviterId, slug],
  );
}
