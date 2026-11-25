#!/usr/bin/env bash
# A cloud session's local stack, started before the first turn needs it.
#
#   scripts/stack/cloud-warmup.sh          # services now, the stack in the background
#   scripts/stack/cloud-warmup.sh --wait   # the same, waiting for `stack.mjs up --web`
#
# A cloud sandbox has Postgres and Redis installed but not running, and no
# `oppenheimer` role or database. This starts both services, creates the role
# and database `.env.example`'s `DB_*` name when they are missing, then runs
# `node scripts/stack/stack.mjs up --web` detached, logging to
# `.stack/warmup.log`. The SessionStart hook runs it on every cloud session
# (`.agents/hooks/session-start.sh`); the stack guard
# (`.agents/hooks/verify-guard.mjs`) then expects the branch to be checked on it.
#
# It never fails: what went wrong is one line on stdout, and the stack can
# still be brought up by hand with the `local-stack` skill.
set -uo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root" || exit 0
mkdir -p .stack
log=.stack/warmup.log

listening() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

if ! listening 5432; then service postgresql start >>"$log" 2>&1 || true; fi
if ! listening 6379; then service redis-server start >>"$log" 2>&1 || true; fi
for _ in $(seq 1 30); do listening 5432 && listening 6379 && break; sleep 0.5; done
if ! listening 5432 || ! listening 6379; then
  echo "The local stack did not start: Postgres or Redis is not listening (log at $root/$log). Bring it up with the local-stack skill."
  exit 0
fi

value() { sed -n "s/^$1=//p" .env.example | head -n 1; }
user=$(value DB_USERNAME)
password=$(value DB_PASSWORD)
database=$(value DB_DATABASE)
as_postgres() { su postgres -c "psql -v ON_ERROR_STOP=1 -tAc \"$1\"" 2>>"$log"; }
if [[ -n "$user" && -n "$database" ]] && command -v psql >/dev/null 2>&1; then
  if [[ "$(as_postgres "select 1 from pg_roles where rolname='$user'")" != 1 ]]; then
    as_postgres "create role $user login createdb password '$password'" >/dev/null
  fi
  if [[ "$(as_postgres "select 1 from pg_database where datname='$database'")" != 1 ]]; then
    as_postgres "create database $database owner $user" >/dev/null
  fi
fi

if [[ "${1:-}" == "--wait" ]]; then
  node scripts/stack/stack.mjs up --web >>"$log" 2>&1 && echo "The local stack is up (log at $root/$log)." \
    || echo "node scripts/stack/stack.mjs up --web failed (log at $root/$log)."
  exit 0
fi
nohup node scripts/stack/stack.mjs up --web >>"$log" 2>&1 </dev/null &
disown
echo "The local stack is starting in the background (log at $root/$log); \`node scripts/stack/stack.mjs status\` says when the API and the console answer. Verify changes on it (the local-stack skill) before you push: the stack guard asks."
exit 0
