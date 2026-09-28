-- One-off, before deploying migration 1790810000000-AddHotPathIndexesAndDropRedundant
-- on a large database (an automation_run, automation_trigger, work_session,
-- work_session_event or session_checkout table over 100k rows or 128 MB).
-- Small databases do not need it: the migration does the same work itself. To
-- undo it, 1790810000000-hot-path-indexes.rollback.sql.
--
-- Run it with psql in autocommit mode (the default; no -1, no BEGIN):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/ops/1790810000000-hot-path-indexes.sql
--
-- Every step can be run again. Nothing here blocks reads or writes for more
-- than a moment: the builds and drops are CONCURRENTLY and wait as long as they
-- need to; the one rename waits at most 5 seconds for its lock, and if it times
-- out you run the script again.

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
              ('IDX_automation_run_dispatched', 'IDX_automation_run_created_brin',
               'IDX_automation_trigger_automation_new',
               'IDX_work_session_event_first_prompt',
               'IDX_work_session_created_by', 'IDX_session_checkout_installation')
  LOOP
    RAISE NOTICE 'dropping invalid index %', r.relname;
    EXECUTE format('DROP INDEX %I', r.relname);  -- plain DROP: invalid indexes are not used
  END LOOP;
END $$;

-- 2. The new indexes, built without blocking writes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_automation_run_dispatched"
  ON "automation_run" ("dispatchedAt") WHERE "outcome" = 'dispatched';
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_work_session_event_first_prompt"
  ON "work_session_event" ("sessionId") WHERE "kind" = 'prompt.first';
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_work_session_created_by"
  ON "work_session" ("createdByUserId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_session_checkout_installation"
  ON "session_checkout" ("organizationId", "installationId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_automation_run_created_brin"
  ON "automation_run" USING brin ("createdAt");

-- 3. IDX_automation_trigger_automation, rebuilt with "automationId" first under
--    the same name: the new one is built beside the old, the old dropped, the
--    new renamed. Skipped once the index under that name is the new one.
SELECT coalesce(
         pg_get_indexdef(to_regclass('public."IDX_automation_trigger_automation"'))
           LIKE '%USING btree ("automationId", "organizationId", "position")',
         false) AS trigger_index_done \gset
\if :trigger_index_done
\echo 'IDX_automation_trigger_automation is already (automationId, organizationId, position)'
\else
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_automation_trigger_automation_new"
  ON "automation_trigger" ("automationId", "organizationId", "position");
DROP INDEX CONCURRENTLY IF EXISTS "IDX_automation_trigger_automation";
SET lock_timeout = '5s';
ALTER INDEX "IDX_automation_trigger_automation_new" RENAME TO "IDX_automation_trigger_automation";
SET lock_timeout = 0;
\endif

-- 4. The two indexes no query reads, dropped without blocking reads or writes.
DROP INDEX CONCURRENTLY IF EXISTS "IDX_session_checkout_session";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_work_session_organization_state";

-- 5. Fresh statistics for the planner.
ANALYZE "automation_run";
ANALYZE "automation_trigger";
ANALYZE "work_session";
ANALYZE "work_session_event";
ANALYZE "session_checkout";
