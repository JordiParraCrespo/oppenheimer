-- One-off, before deploying migration 1790800000000-OutboxPendingIndexAndRetention
-- on a large database (an outbox_message table over 100k rows or 128 MB).
-- Small databases do not need it: the migration does the same work itself.
-- To undo it, 1790800000000-outbox-pending-index.rollback.sql.
--
-- Run it with psql in autocommit mode (the default; no -1, no BEGIN):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/ops/1790800000000-outbox-pending-index.sql
--
-- Every step can be run again. Nothing here blocks reads or writes for more
-- than a moment: the builds and the drop are CONCURRENTLY, and each waits at
-- most 5 seconds for its lock; if one times out, run the script again.

\set ON_ERROR_STOP 1
SET statement_timeout = 0;
SET lock_timeout = '5s';

-- 1. What you are about to index. A large processed count is expected: nothing
--    purged the table before this change; the daily retention job does now.
SELECT "status", count(*) AS "rows", min("createdAt") AS oldest
  FROM "outbox_message" GROUP BY "status" ORDER BY "status";

-- 2. An interrupted concurrent build leaves an INVALID index behind; drop it so
--    the build can be retried.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE NOT i.indisvalid AND c.relnamespace = 'public'::regnamespace AND c.relname IN
              ('IDX_outbox_message_pending', 'IDX_outbox_message_created_brin')
  LOOP
    RAISE NOTICE 'dropping invalid index %', r.relname;
    EXECUTE format('DROP INDEX %I', r.relname);  -- plain DROP: invalid indexes are not used
  END LOOP;
END $$;

-- 3. The new indexes, built without blocking writes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_outbox_message_pending"
  ON "outbox_message" ("createdAt") WHERE "status" = 'pending';
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_outbox_message_created_brin"
  ON "outbox_message" USING brin ("createdAt");

-- 4. The old index: the claim no longer reads it, and dropping it is what lets
--    a lease or a retry be a HOT update.
DROP INDEX CONCURRENTLY IF EXISTS "IDX_outbox_message_status_available";

-- 5. Fresh statistics for the planner.
ANALYZE "outbox_message";
