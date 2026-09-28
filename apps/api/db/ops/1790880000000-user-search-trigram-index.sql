-- One-off, before deploying migration 1790880000000-AddUserSearchTrigramIndex
-- on a large database (a "user" table over 100k rows or 128 MB). Small
-- databases do not need it: the migration builds the index itself. To undo it,
-- 1790880000000-user-search-trigram-index.rollback.sql.
--
-- Run it with psql in autocommit mode (the default; no -1, no BEGIN):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/ops/1790880000000-user-search-trigram-index.sql
--
-- Every step can be run again. The build is CONCURRENTLY, so sign-ups and
-- profile writes carry on while it runs, however long that takes.

\set ON_ERROR_STOP 1
SET statement_timeout = 0;
SET lock_timeout = 0;

-- 1. pg_trgm is a trusted extension (Postgres 13+): the database owner can
--    create it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. An interrupted concurrent build leaves an INVALID index behind; drop it
--    so the build can be retried.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE NOT i.indisvalid AND c.relnamespace = 'public'::regnamespace
              AND c.relname = 'IDX_user_search_trgm'
  LOOP
    RAISE NOTICE 'dropping invalid index %', r.relname;
    EXECUTE format('DROP INDEX %I', r.relname);  -- plain DROP: invalid indexes are not used
  END LOOP;
END $$;

-- 3. The index, built without blocking writes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_user_search_trgm"
  ON "user" USING gin ("firstName" gin_trgm_ops, "lastName" gin_trgm_ops, "email" gin_trgm_ops);

-- 4. Fresh statistics for the planner.
ANALYZE "user";
