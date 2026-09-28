-- One-off, before reverting migration 1790890000000-IndexUnbackedForeignKeys
-- on a large database. Its down() refuses to drop these indexes inside the
-- boot transaction on a large table (DROP INDEX blocks reads and writes until
-- the transaction commits); this drops them without blocking, after which
-- down() has nothing left to do.
--
-- Run it with psql in autocommit mode (the default; no -1, no BEGIN):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/ops/1790890000000-foreign-key-indexes.rollback.sql
--
-- It can be run again.

\set ON_ERROR_STOP 1
SET statement_timeout = 0;
SET lock_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS "IDX_user_role_role";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_user_role_organization";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_host_pairing_token_redeemed_host";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_github_installation_installed_by";
