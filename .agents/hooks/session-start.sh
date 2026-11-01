#!/usr/bin/env bash
# SessionStart hook: a cloud session starts with its dependencies installed,
# so Biome, the tests and the architecture check work from the first turn.
#
# It runs `pnpm install --frozen-lockfile` only when `node_modules` is
# missing or was installed from another `pnpm-lock.yaml`: a successful
# install leaves the lockfile's hash in `node_modules/.oppenheimer-lockfile`,
# and a session whose lockfile still matches it does nothing. It installs only
# in a Claude Code cloud session (`CLAUDE_CODE_REMOTE=true`); on someone's own
# machine it says that node_modules is missing and leaves the install to them.
# It never fails the session: whatever happens, it exits 0, and what went
# wrong is one line in the session's context.
set -uo pipefail
cat >/dev/null

root=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
cd "$root" 2>/dev/null || exit 0
[[ -f pnpm-lock.yaml ]] || exit 0

stamp=node_modules/.oppenheimer-lockfile
want=$(git hash-object pnpm-lock.yaml 2>/dev/null || cksum <pnpm-lock.yaml)
[[ -d node_modules && -f "$stamp" && "$(cat "$stamp")" == "$want" ]] && exit 0

if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]]; then
  [[ -d node_modules ]] || echo 'node_modules is missing: run `pnpm install --frozen-lockfile` before Biome, the tests or `pnpm arch`.'
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo 'Dependencies were not installed: pnpm is not on PATH. Run `corepack enable && pnpm install --frozen-lockfile`.'
  exit 0
fi

log="${TMPDIR:-/tmp}/oppenheimer-session-start.log"
if CI=true pnpm install --frozen-lockfile >"$log" 2>&1; then
  printf '%s' "$want" >"$stamp"
  echo "Installed dependencies (pnpm install --frozen-lockfile; log at $log)."
else
  echo "pnpm install --frozen-lockfile failed (log at $log); run it again before Biome, the tests or \`pnpm arch\`."
fi
exit 0
