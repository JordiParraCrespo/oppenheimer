-- One-off, before reverting migration 1790810000000-AddHotPathIndexesAndDropRedundant
-- on a large database. Its down() refuses to build or drop these indexes
-- inside the boot transaction on a large table; this puts the pre-migration
-- index set back without blocking, after which down() has nothing left to do.
--
-- Run it with psql in autocommit mode (the default; no -1, no BEGIN):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/ops/1790810000000-hot-path-indexes.rollback.sql
--
-- Every step can be run again. The builds and drops are CONCURRENTLY and wait
-- as long as they need to; the one rename waits at most 5 seconds for its lock,
-- and if it times out you run the script again.

\set ON_ERROR_STOP 1
SET statement_timeout = 0;
SET lock_timeout = 0;

-- 1. An interrupted concurrent build leaves an INVALID index behind; drop it
--    so the build can be retried.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE NOT i.indisvalid AND c.relnamespace = 'public'::regnamespace AND c.relname IN
              ('IDX_session_checkout_session', 'IDX_work_session_organization_state',
               'IDX_automation_trigger_automation_old')
  LOOP
    RAISE NOTICE 'dropping invalid index %', r.relname;
    EXECUTE format('DROP INDEX %I', r.relname);  -- plain DROP: invalid indexes are not used
  END LOOP;
END $$;

-- 2. The two dropped indexes, with their original definitions.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_work_session_organization_state"
  ON "work_session" ("organizationId", "state", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_session_checkout_session"
  ON "session_checkout" ("sessionId");

-- 3. IDX_automation_trigger_automation back to ("organizationId", "automationId",
--    "position"), the same way it was rebuilt.
SELECT coalesce(
         pg_get_indexdef(to_regclass('public."IDX_automation_trigger_automation"'))
           LIKE '%USING btree ("organizationId", "automationId", "position")',
         false) AS trigger_index_done \gset
\if :trigger_index_done
\echo 'IDX_automation_trigger_automation is already (organizationId, automationId, position)'
\else
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_automation_trigger_automation_old"
  ON "automation_trigger" ("organizationId", "automationId", "position");
DROP INDEX CONCURRENTLY IF EXISTS "IDX_automation_trigger_automation";
SET lock_timeout = '5s';
ALTER INDEX "IDX_automation_trigger_automation_old" RENAME TO "IDX_automation_trigger_automation";
SET lock_timeout = 0;
\endif

-- 4. The new indexes, without blocking reads or writes.
DROP INDEX CONCURRENTLY IF EXISTS "IDX_automation_run_created_brin";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_session_checkout_installation";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_work_session_created_by";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_work_session_event_first_prompt";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_automation_run_dispatched";

-- 5. Now revert the migration (pnpm --filter @oppenheimer/api migration:revert).
