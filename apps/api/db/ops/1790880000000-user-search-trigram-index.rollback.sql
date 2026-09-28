-- One-off, before reverting migration 1790880000000-AddUserSearchTrigramIndex
-- on a large database. Its down() refuses to drop the index inside the boot
-- transaction on a large "user" table (DROP INDEX blocks reads and writes
-- until the transaction commits); this drops it without blocking, after which
-- down() has nothing left to do. The pg_trgm extension stays, as down() leaves
-- it.
--
-- Run it with psql in autocommit mode (the default; no -1, no BEGIN):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/ops/1790880000000-user-search-trigram-index.rollback.sql
--
-- It can be run again.

\set ON_ERROR_STOP 1
SET statement_timeout = 0;
SET lock_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS "IDX_user_search_trgm";
