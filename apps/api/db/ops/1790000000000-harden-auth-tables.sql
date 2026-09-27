-- One-off, before deploying migration 1790000000000-HardenAuthTables on a
-- large database (a session, account, verification or invitation table over
-- 100k rows or 128 MB). Small databases do not need it: the migration does
-- the same work itself. To undo it, 1790000000000-harden-auth-tables.rollback.sql.
--
-- Run it with psql in autocommit mode (the default; no -1, no BEGIN):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/ops/1790000000000-harden-auth-tables.sql
--
-- Every step can be run again. Nothing here blocks reads or writes for more
-- than a moment: the index builds are CONCURRENTLY and wait as long as they
-- need to; the catalog steps (NOT VALID keys, attaching the unique index) wait
-- at most 3 seconds for their lock, and if one times out you run the script
-- again. VALIDATE CONSTRAINT only takes a SHARE UPDATE EXCLUSIVE lock.

\set ON_ERROR_STOP 1
SET statement_timeout = 0;

-- 1. What you are about to change. Stop here if a count looks wrong: step 3
--    deletes the duplicates, step 5 the orphans.
SELECT current_setting('server_version') AS postgres,
       current_setting('TimeZone') AS database_time_zone;
SELECT 'session.userId' AS "column", 'delete' AS fix, count(*) AS orphans
  FROM "session" s WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = s."userId")
UNION ALL
SELECT 'session.impersonatedBy', 'delete', count(*)
  FROM "session" s WHERE s."impersonatedBy" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = s."impersonatedBy")
UNION ALL
SELECT 'session.activeOrganizationId', 'set null', count(*)
  FROM "session" s WHERE s."activeOrganizationId" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "organization" o WHERE o."id" = s."activeOrganizationId")
UNION ALL
SELECT 'session.activeTeamId', 'set null', count(*)
  FROM "session" s WHERE s."activeTeamId" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "team" t WHERE t."id" = s."activeTeamId")
UNION ALL
SELECT 'account.userId', 'delete', count(*)
  FROM "account" a WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = a."userId");
-- Every (providerId, accountId) with more than one row. Step 3 keeps the most
-- recently updated row of each and deletes the others.
SELECT "providerId", "accountId", count(*) AS "rows", array_agg("userId") AS "userIds"
  FROM "account" GROUP BY "providerId", "accountId" HAVING count(*) > 1;

-- 2. Indexes, built without blocking writes. An interrupted concurrent build
--    leaves an INVALID index behind; drop it so the build can be retried.
SET lock_timeout = 0;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE NOT i.indisvalid AND c.relnamespace = 'public'::regnamespace AND c.relname IN
              ('IDX_session_userId', 'IDX_session_impersonatedBy',
               'IDX_session_activeOrganizationId', 'IDX_session_activeTeamId',
               'IDX_account_userId', 'UQ_account_providerId_accountId',
               'IDX_verification_identifier_createdAt', 'IDX_verification_expiresAt',
               'IDX_invitation_inviterId', 'IDX_invitation_teamId')
  LOOP
    RAISE NOTICE 'dropping invalid index %', r.relname;
    EXECUTE format('DROP INDEX %I', r.relname);  -- plain DROP: invalid indexes are not used
  END LOOP;
END $$;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_session_userId" ON "session" ("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_session_impersonatedBy" ON "session" ("impersonatedBy")
  WHERE "impersonatedBy" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_session_activeOrganizationId" ON "session" ("activeOrganizationId")
  WHERE "activeOrganizationId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_session_activeTeamId" ON "session" ("activeTeamId")
  WHERE "activeTeamId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_account_userId" ON "account" ("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_verification_identifier_createdAt" ON "verification" ("identifier", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_verification_expiresAt" ON "verification" ("expiresAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_invitation_inviterId" ON "invitation" ("inviterId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_invitation_teamId" ON "invitation" ("teamId")
  WHERE "teamId" IS NOT NULL;

-- 3. The unique (providerId, accountId). Duplicates first (step 1 listed them;
--    normally none), keeping the most recently updated row of each pair; then
--    the index is built without blocking writes and attached as the constraint
--    (a catalog change).
--    A duplicate written between the delete and the build fails the build;
--    run the script again.
DO $$
DECLARE n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_account_providerId_accountId') THEN
    RETURN;
  END IF;
  DELETE FROM "account" a
   USING "account" newer
   WHERE newer."providerId" = a."providerId" AND newer."accountId" = a."accountId"
     AND (newer."updatedAt", newer."id") > (a."updatedAt", a."id");
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'duplicate account rows deleted: %', n;
END $$;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "UQ_account_providerId_accountId"
  ON "account" ("providerId", "accountId");
SET lock_timeout = '3s';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_account_providerId_accountId') THEN
    ALTER TABLE "account" ADD CONSTRAINT "UQ_account_providerId_accountId"
      UNIQUE USING INDEX "UQ_account_providerId_accountId";
  END IF;
END $$;

-- 4. Foreign keys, NOT VALID: a catalog change; new rows are checked from now on.
DO $$
DECLARE k record;
BEGIN
  FOR k IN SELECT * FROM (VALUES
      ('session', 'FK_session_user', 'userId', 'user', 'CASCADE'),
      ('session', 'FK_session_impersonatedBy', 'impersonatedBy', 'user', 'CASCADE'),
      ('session', 'FK_session_activeOrganization', 'activeOrganizationId', 'organization', 'SET NULL'),
      ('session', 'FK_session_activeTeam', 'activeTeamId', 'team', 'SET NULL'),
      ('account', 'FK_account_user', 'userId', 'user', 'CASCADE')
    ) AS v(tbl, name, col, ref, on_delete)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = k.name) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I ("id") ON DELETE %s NOT VALID',
                     k.tbl, k.name, k.col, k.ref, k.on_delete);
    END IF;
  END LOOP;
END $$;
SET lock_timeout = 0;

-- 5. Orphaned rows get what ON DELETE would have done to them, in batches of
--    5,000, each committed on its own and found by ctid, so a batch locks only
--    its own rows. Orphans are normally few: one or two passes.
DO $$
DECLARE n integer;
BEGIN
  LOOP
    DELETE FROM "session" WHERE ctid = ANY (ARRAY(
      SELECT s.ctid FROM "session" s
       WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = s."userId")
          OR (s."impersonatedBy" IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = s."impersonatedBy"))
       LIMIT 5000));
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'session orphans deleted: %', n;
    EXIT WHEN n = 0;
    COMMIT;
  END LOOP;
  LOOP
    UPDATE "session" SET "activeOrganizationId" = NULL WHERE ctid = ANY (ARRAY(
      SELECT s.ctid FROM "session" s
       WHERE s."activeOrganizationId" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "organization" o WHERE o."id" = s."activeOrganizationId")
       LIMIT 5000));
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'session.activeOrganizationId cleared: %', n;
    EXIT WHEN n = 0;
    COMMIT;
  END LOOP;
  LOOP
    UPDATE "session" SET "activeTeamId" = NULL WHERE ctid = ANY (ARRAY(
      SELECT s.ctid FROM "session" s
       WHERE s."activeTeamId" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "team" t WHERE t."id" = s."activeTeamId")
       LIMIT 5000));
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'session.activeTeamId cleared: %', n;
    EXIT WHEN n = 0;
    COMMIT;
  END LOOP;
  LOOP
    DELETE FROM "account" WHERE ctid = ANY (ARRAY(
      SELECT a.ctid FROM "account" a
       WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = a."userId") LIMIT 5000));
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'account orphans deleted: %', n;
    EXIT WHEN n = 0;
    COMMIT;
  END LOOP;
END $$;

-- 6. Check the existing rows against the keys. Reads and writes carry on.
ALTER TABLE "session" VALIDATE CONSTRAINT "FK_session_user";
ALTER TABLE "session" VALIDATE CONSTRAINT "FK_session_impersonatedBy";
ALTER TABLE "session" VALIDATE CONSTRAINT "FK_session_activeOrganization";
ALTER TABLE "session" VALIDATE CONSTRAINT "FK_session_activeTeam";
ALTER TABLE "account" VALIDATE CONSTRAINT "FK_account_user";

-- 7. Fresh statistics for the planner.
ANALYZE "session";
ANALYZE "account";
ANALYZE "verification";
ANALYZE "invitation";
