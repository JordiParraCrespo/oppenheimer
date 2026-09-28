-- One-off, before reverting migration 1790800000000-OutboxPendingIndexAndRetention
-- on a large database. Its down() refuses to build or drop these indexes inside
-- the boot transaction on a large table; this does it without blocking, after
-- which down() finds nothing left to change.
--
-- Run it with psql in autocommit mode (the default; no -1, no BEGIN):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/ops/1790800000000-outbox-pending-index.rollback.sql
--
-- Every step can be run again. Each statement waits at most 5 seconds for its
-- lock; if one times out, run the script again.

\set ON_ERROR_STOP 1
SET statement_timeout = 0;
SET lock_timeout = '5s';

-- 1. The original index back, built without blocking writes. An interrupted
--    build leaves it INVALID; drop it so the build can be retried.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
              WHERE NOT i.indisvalid AND c.relnamespace = 'public'::regnamespace
                AND c.relname = 'IDX_outbox_message_status_available') THEN
    RAISE NOTICE 'dropping invalid index IDX_outbox_message_status_available';
    DROP INDEX "IDX_outbox_message_status_available";  -- plain DROP: invalid indexes are not used
  END IF;
END $$;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_outbox_message_status_available"
  ON "outbox_message" ("status", "availableAt");

-- 2. The indexes the migration added.
DROP INDEX CONCURRENTLY IF EXISTS "IDX_outbox_message_created_brin";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_outbox_message_pending";

-- 3. Now revert the migration (pnpm --filter @oppenheimer/api migration:revert).
