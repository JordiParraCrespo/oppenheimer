-- What "the restore worked" means for Oppenheimer's database. Run by the
-- db-backup-verify skill's restore-drill.sh against the restored copy:
--
--   ASSERTIONS=deploy/dev/backup/assertions.sql restore-drill.sh run
--
-- Every row is check_name | passed | detail, and the drill fails on any false.
-- pg_restore exiting 0 only proves the file parsed; these prove the schema and
-- the rows people made came back. A dev deployment has no row volume worth a
-- floor, so the checks are presence, not counts.

-- The dump came from this application's database, not an empty or wrong one.
SELECT
  'migrations table present and applied',
  count(*) > 0,
  count(*) || ' migrations, newest '
    || coalesce((SELECT name FROM migrations ORDER BY "timestamp" DESC LIMIT 1), 'none')
FROM migrations;

-- The tables everything else hangs off.
SELECT
  'core tables restored',
  count(*) = 6,
  string_agg(table_name, ', ' ORDER BY table_name)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user', 'account', 'organization', 'member', 'host', 'project');

-- Somebody has signed up. Fails on a dump taken before the first account,
-- which is the point: until then there is nothing to restore.
SELECT
  'at least one account',
  count(*) >= 1,
  count(*) || ' users'
FROM "user";

-- Memberships survived with both ends: a partial restore, or a dump taken
-- mid-migration, usually shows up as orphans.
SELECT
  'every member row points at a user and an organization',
  count(*) = 0,
  count(*) || ' orphaned memberships'
FROM member m
LEFT JOIN "user" u ON u.id = m."userId"
LEFT JOIN organization o ON o.id = m."organizationId"
WHERE u.id IS NULL OR o.id IS NULL;
