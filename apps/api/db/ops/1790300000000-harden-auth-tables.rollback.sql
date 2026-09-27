-- One-off, before reverting migration 1790300000000-HardenAuthTables on a
-- large database. Its down() refuses to drop these indexes inside the boot
-- transaction on a large table; this removes them without blocking, after
-- which down() has only the constraint renames left.
-- FK_session_user, FK_account_user and their indexes stay: they belong to
-- 1790200000000-CascadeSignInsWithTheirUser.
--
-- Run it with psql in autocommit mode (the default; no -1, no BEGIN):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/db/ops/1790300000000-harden-auth-tables.rollback.sql
--
-- Every step can be run again. Dropping a key or a constraint is a catalog
-- change that waits at most 3 seconds for its lock; if one times out, run the
-- script again. The concurrent drops wait as long as they need to.

\set ON_ERROR_STOP 1
SET statement_timeout = 0;

-- 1. The foreign keys and the unique constraint (its index goes with it).
SET lock_timeout = '3s';
ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "FK_session_activeTeam";
ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "FK_session_activeOrganization";
ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "FK_session_impersonatedBy";
ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "UQ_account_providerId_accountId";

-- 2. The indexes, without blocking reads or writes.
SET lock_timeout = 0;
DROP INDEX CONCURRENTLY IF EXISTS "UQ_account_providerId_accountId";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_invitation_teamId";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_invitation_inviterId";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_verification_expiresAt";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_verification_identifier_createdAt";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_session_activeTeamId";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_session_activeOrganizationId";
DROP INDEX CONCURRENTLY IF EXISTS "IDX_session_impersonatedBy";

-- 3. Now revert the migration (pnpm --filter @oppenheimer/api migration:revert).
