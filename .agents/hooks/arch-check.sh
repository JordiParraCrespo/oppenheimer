#!/usr/bin/env bash
# Stop hook: enforce the architecture boundaries before a task ends. Runs
# dependency-cruiser for the API (apps/api/ARCHITECTURE.md) and for the
# frontend tier (packages/frontend/ARCHITECTURE.md, the apps' ARCHITECTURE.md)
# when their source changed, plus the frontend layout contract, and blocks the
# stop with the violations so they get fixed in-loop.
set -uo pipefail
input=$(cat)

# Avoid infinite loops: if we already blocked once this turn, allow the stop.
if echo "$input" | jq -e '.stop_hook_active == true' >/dev/null 2>&1; then
  exit 0
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$repo_root" || exit 0

api_changed=$(git status --porcelain -- apps/api/src 2>/dev/null)
frontend_changed=$(git status --porcelain -- packages/frontend 2>/dev/null)
# oppenheimer:begin web|admin-web|mobile|admin-mobile
frontend_changed+=$(git status --porcelain -- apps/web apps/admin-web apps/mobile apps/admin-mobile 2>/dev/null)
# oppenheimer:end web|admin-web|mobile|admin-mobile

[[ -z "$api_changed" && -z "$frontend_changed" ]] && exit 0

# Skip silently if the checker isn't installed yet (e.g. before pnpm install).
if ! pnpm --filter @oppenheimer/api exec depcruise --version >/dev/null 2>&1; then
  exit 0
fi

# `pnpm arch` goes through turbo, which builds upstream packages first so
# dependency-cruiser can resolve the @oppenheimer/* workspace imports.
output=$(pnpm arch 2>&1)
status=$?

if [[ -n "$frontend_changed" ]]; then
  structure=$(node scripts/check-frontend-structure.mjs 2>&1) || {
    status=1
    output="$output"$'\n\n'"$structure"
  }
fi

if [[ "$status" -ne 0 ]]; then
  reason=$(printf 'Architecture check failed. Fix these boundary violations before finishing — see the ARCHITECTURE.md of what you changed:\n\n%s' "$output")
  jq -n --arg r "$reason" '{decision: "block", reason: $r}'
fi
exit 0
