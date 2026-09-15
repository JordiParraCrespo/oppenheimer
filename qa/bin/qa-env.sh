#!/usr/bin/env bash
#
# Brings up the stack the QA pack runs against, and takes it down again.
#
# `pnpm docker:up` is the normal way to get Postgres and Redis, and it is what
# this script prefers. It is not always available — a CI runner or a sandbox may
# have the docker CLI installed with no daemon behind it — so when the daemon
# does not answer, the script falls back to the Postgres and Redis already
# installed on the machine. Both routes end at the same place: a database on
# 5432, Redis on 6379, the API on 3001, the consumer app on 3000 and the control
# plane on 3003.
#
#   qa/bin/qa-env.sh up       start everything and wait until it answers
#   qa/bin/qa-env.sh down     stop what this script started
#   qa/bin/qa-env.sh status   report what is currently answering
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACTS="$ROOT/qa/artifacts"
API_URL="${QA_API_URL:-http://localhost:3001}"
WEB_URL="${QA_WEB_URL:-http://localhost:3000}"
ADMIN_WEB_URL="${QA_ADMIN_WEB_URL:-http://localhost:3003}"

log() { printf '\033[36m[qa-env]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[qa-env]\033[0m %s\n' "$*" >&2; exit 1; }

have_docker() { docker info >/dev/null 2>&1; }

wait_for() { # wait_for <url> <seconds> <label>
  local url=$1 timeout=$2 label=$3
  local deadline=$(( SECONDS + timeout ))
  until curl -sf "$url" >/dev/null 2>&1; do
    (( SECONDS >= deadline )) && return 1
    sleep 2
  done
  log "$label is answering"
}

start_datastores() {
  if have_docker; then
    log 'starting Postgres and Redis via docker compose'
    (cd "$ROOT" && pnpm docker:up) || die 'docker compose failed'
    return
  fi

  log 'no docker daemon — using the locally installed Postgres and Redis'
  command -v pg_ctlcluster >/dev/null || die 'neither docker nor a local Postgres is available'

  pg_isready -q 2>/dev/null || pg_ctlcluster 16 main start || die 'could not start Postgres'
  redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes --port 6379 || die 'could not start Redis'

  # The credentials the app expects. Both statements are safe to repeat: a
  # second run finds the role and the database already there and moves on.
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='oppenheimer'\"" | grep -q 1 || \
    su postgres -c "psql -c \"CREATE ROLE oppenheimer WITH LOGIN SUPERUSER PASSWORD 'oppenheimer'\"" >/dev/null
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='oppenheimer'\"" | grep -q 1 || \
    su postgres -c "psql -c \"CREATE DATABASE oppenheimer OWNER oppenheimer\"" >/dev/null
  log 'Postgres and Redis are answering'
}

# The mail sink is the harness's only way to read a reset or invitation link,
# and it depends on two things being true of the API process: it writes its
# stdout to $ARTIFACTS/api.log, and it was started with the console email
# provider. Neither is visible over HTTP, so `up` checks them here rather than
# letting AUTH-02 and AUTH-03 discover it as a timeout twenty minutes later.
#
# "A log file exists" is not the check. A previous run leaves one behind, so a
# developer's own `pnpm dev` on this port would satisfy it while writing its
# mail to a terminal nobody is reading — the stack reports ready and the
# mail-driven scenarios then poll a stale file until they time out. What has to
# be true is that the process *currently answering on this port* has this file
# as its stdout, so the check follows the listener to its file descriptor.

# The pid listening on the API port, via whichever tool this image ships.
api_listener_pid() {
  local pid=''
  if command -v ss >/dev/null 2>&1; then
    pid=$(ss -lptnH "sport = :${API_URL##*:}" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
  fi
  if [ -z "$pid" ] && command -v lsof >/dev/null 2>&1; then
    pid=$(lsof -tiTCP:"${API_URL##*:}" -sTCP:LISTEN 2>/dev/null | head -1)
  fi
  printf '%s' "$pid"
}

# Whether that process, or any of its children, writes stdout to the sink. The
# API is started through pnpm, so the file descriptor belongs to a descendant.
writes_to_sink() {
  local pid=$1 target
  target=$(readlink -f "$ARTIFACTS/api.log" 2>/dev/null) || return 1
  [ -n "$pid" ] || return 1
  local candidates
  candidates=$(pgrep -P "$pid" 2>/dev/null; printf '%s\n' "$pid")
  for candidate in $candidates; do
    [ "$(readlink -f "/proc/$candidate/fd/1" 2>/dev/null)" = "$target" ] && return 0
  done
  return 1
}

mail_sink_ready() {
  [ -s "$ARTIFACTS/api.log" ] || return 1
  grep -qE '^EMAIL_PROVIDER=console[[:space:]]*$' "$ROOT/.env" 2>/dev/null || return 1
  local pid
  pid=$(api_listener_pid)
  if [ -z "$pid" ]; then
    # No way to identify the listener on this image. Refuse to claim the sink
    # is ready on the strength of a file that may be last week's.
    log 'cannot identify the process listening on the API port — treating the mail sink as not ready'
    return 1
  fi
  writes_to_sink "$pid"
}

ensure_env() {
  if [ -f "$ROOT/.env" ]; then
    log '.env already present — left alone'
    # One exception to leaving it alone: without the console provider there is
    # no mail sink, and two auth scenarios cannot run at all.
    grep -qE '^EMAIL_PROVIDER=console[[:space:]]*$' "$ROOT/.env" || {
      log 'EMAIL_PROVIDER is not "console" — the QA mail sink needs it; set it in .env'
      die 'refusing to start with no mail sink'
    }
    return
  fi
  log 'writing .env from .env.example'
  cp "$ROOT/.env.example" "$ROOT/.env"
  # The one the API refuses to boot without. Throwaway and local-only.
  sed -i 's|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=qa-local-secret-not-a-real-secret|' "$ROOT/.env"
  # Mail is the QA sink: the worker logs the reset and invitation URLs instead
  # of sending them, and the harness reads them back out of the API log.
  sed -i 's|^EMAIL_PROVIDER=.*|EMAIL_PROVIDER=console|' "$ROOT/.env"
}

up() {
  mkdir -p "$ARTIFACTS"
  ensure_env
  start_datastores

  if curl -sf "$API_URL/api/v1/health" >/dev/null 2>&1 && mail_sink_ready; then
    log 'API already answering, and its mail is landing in the sink — reusing it'
  else
    # An API answering on this port that is *not* writing to the sink — a
    # developer's `pnpm dev`, or a previous run started differently — is worse
    # than no API: health passes, `up` reports a ready stack, and the mail-driven
    # scenarios then wait out their timeouts on links that were never logged
    # anywhere the harness can read. Take it over rather than reuse it.
    if curl -sf "$API_URL/api/v1/health" >/dev/null 2>&1; then
      log 'an API is answering but its mail is not reaching the sink — restarting it under QA control'
      pkill -f 'nest start' 2>/dev/null
      pkill -f 'node dist/main' 2>/dev/null
      # Wait for the port to actually come free, or the restart races it.
      for _ in $(seq 1 30); do
        curl -sf "$API_URL/api/v1/health" >/dev/null 2>&1 || break
        sleep 1
      done
    fi
    log 'building the workspace (needed for the API and the shared packages)'
    (cd "$ROOT" && pnpm build) >"$ARTIFACTS/build.log" 2>&1 || die "build failed — see $ARTIFACTS/build.log"
    # Unlike the pack this was ported from, this API does not migrate on boot,
    # so the schema has to be brought up before the process that needs it.
    log 'running migrations'
    (cd "$ROOT" && pnpm --filter @oppenheimer/api migration:run) >"$ARTIFACTS/migrate.log" 2>&1 \
      || die "migrations failed — see $ARTIFACTS/migrate.log"
    log 'starting the API'
    (cd "$ROOT" && nohup pnpm --filter @oppenheimer/api start >"$ARTIFACTS/api.log" 2>&1 &)
    wait_for "$API_URL/api/v1/health" 180 'API' || die "API did not come up — see $ARTIFACTS/api.log"
    log 'seeding the platform accounts'
    (cd "$ROOT" && pnpm --filter @oppenheimer/api seed) >>"$ARTIFACTS/api.log" 2>&1 || die 'seed failed'
  fi

  if curl -sf "$WEB_URL" >/dev/null 2>&1; then
    log 'consumer app already answering — reusing it'
  else
    log 'starting the consumer app'
    (cd "$ROOT" && nohup pnpm --filter @oppenheimer/web dev >"$ARTIFACTS/web.log" 2>&1 &)
    wait_for "$WEB_URL" 120 'consumer app' || die "web app did not come up — see $ARTIFACTS/web.log"
  fi

  # The control plane is a second app, and AUTH-08 is entirely about it. Its
  # absence would otherwise read as "every role is refused", which is the same
  # shape as a pass.
  if curl -sf "$ADMIN_WEB_URL" >/dev/null 2>&1; then
    log 'control plane already answering — reusing it'
  else
    log 'starting the control plane'
    (cd "$ROOT" && nohup pnpm --filter @oppenheimer/admin-web dev >"$ARTIFACTS/admin-web.log" 2>&1 &)
    wait_for "$ADMIN_WEB_URL" 120 'control plane' \
      || die "admin-web did not come up — see $ARTIFACTS/admin-web.log"
  fi

  log "ready: web $WEB_URL, control plane $ADMIN_WEB_URL, API $API_URL"
}

down() {
  log 'stopping the API and both web apps'
  pkill -f 'nest start' 2>/dev/null
  pkill -f 'node dist/main' 2>/dev/null
  pkill -f 'vite --port 3000' 2>/dev/null
  pkill -f 'vite --port 3003' 2>/dev/null
  # Datastores are left running on purpose: they hold the fixtures, and the next
  # `up` is much faster with them warm. `pnpm docker:down` takes them down when
  # that is what you want.
  log 'datastores left running (they hold the fixtures)'
}

status() {
  curl -sf "$API_URL/api/v1/health" >/dev/null 2>&1 && echo "API    answering  $API_URL" || echo "API    down       $API_URL"
  curl -sf "$WEB_URL" >/dev/null 2>&1 && echo "web    answering  $WEB_URL" || echo "web    down       $WEB_URL"
  curl -sf "$ADMIN_WEB_URL" >/dev/null 2>&1 && echo "admin  answering  $ADMIN_WEB_URL" || echo "admin  down       $ADMIN_WEB_URL"
  pg_isready -q 2>/dev/null && echo 'pg     answering  localhost:5432' || echo 'pg     down       localhost:5432'
  redis-cli ping >/dev/null 2>&1 && echo 'redis  answering  localhost:6379' || echo 'redis  down       localhost:6379'
}

case "${1:-up}" in
  up) up ;;
  down) down ;;
  status) status ;;
  *) die "unknown command: $1 (expected up, down or status)" ;;
esac
