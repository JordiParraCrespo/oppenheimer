#!/usr/bin/env bash
# Stop hook: enforce the architecture boundaries before a task ends, and block
# the stop with the violations so they get fixed in-loop. What it checks, and
# how, is `arch-check.mjs` beside it; this only runs it once per turn.
set -uo pipefail
input=$(cat)

# Avoid infinite loops: if we already blocked once this turn, allow the stop.
if echo "$input" | jq -e '.stop_hook_active == true' >/dev/null 2>&1; then
  exit 0
fi

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd) || exit 0
repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$repo_root" || exit 0
# A clean tree has nothing to check; spare it node's start.
[[ -z $(git status --porcelain 2>/dev/null) ]] && exit 0
node "$here/arch-check.mjs" 2>/dev/null
exit 0
