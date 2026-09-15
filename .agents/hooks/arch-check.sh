#!/usr/bin/env bash
# Stop hook: enforce the API's Domain-Driven Hexagon boundaries before a task
# ends. Runs dependency-cruiser when apps/api source changed and blocks the stop
# with the violations so they get fixed in-loop. See apps/api/ARCHITECTURE.md.
set -uo pipefail
input=$(cat)

# Avoid infinite loops: if we already blocked once this turn, allow the stop.
if echo "$input" | jq -e '.stop_hook_active == true' >/dev/null 2>&1; then
  exit 0
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$repo_root" || exit 0

# Only run when API source actually changed (staged, unstaged or untracked).
if [[ -z "$(git status --porcelain -- apps/api/src 2>/dev/null)" ]]; then
  exit 0
fi

# Skip silently if the checker isn't installed yet (e.g. before pnpm install).
if ! pnpm --filter @oppenheimer/api exec depcruise --version >/dev/null 2>&1; then
  exit 0
fi

# `pnpm arch` goes through turbo, which builds upstream packages first so
# dependency-cruiser can resolve the @oppenheimer/* workspace imports.
output=$(pnpm arch 2>&1)
status=$?

if [[ "$status" -ne 0 ]]; then
  reason=$(printf 'API architecture check failed (dependency-cruiser). Fix these boundary violations before finishing — see apps/api/ARCHITECTURE.md:\n\n%s' "$output")
  jq -n --arg r "$reason" '{decision: "block", reason: $r}'
fi
exit 0
