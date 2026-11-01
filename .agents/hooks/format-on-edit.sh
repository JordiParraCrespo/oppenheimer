#!/usr/bin/env bash
# PostToolUse hook on Write|Edit: format the file just written with Biome.
# It calls the checkout's own `node_modules/.bin/biome`, not `pnpm exec`,
# which spends a second starting pnpm before Biome runs. It never blocks: a
# file Biome cannot parse or does not cover is left for `pnpm check`. When
# Biome is not installed (no `node_modules` yet), it says so once per session
# instead of formatting nothing in silence.
set -uo pipefail
input=$(cat)

file=$(jq -r '.tool_response.filePath // .tool_input.file_path // .file_path // empty' <<<"$input" 2>/dev/null)
[[ -n "$file" && -f "$file" ]] || exit 0

# The checkout the file is in (a worktree has its own node_modules).
root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null)
biome="${root:-${CLAUDE_PROJECT_DIR:-$PWD}}/node_modules/.bin/biome"
if [[ ! -x "$biome" && -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
  biome="$CLAUDE_PROJECT_DIR/node_modules/.bin/biome"
fi

if [[ -x "$biome" ]]; then
  "$biome" format --write --files-ignore-unknown=true --no-errors-on-unmatched "$file" >/dev/null 2>&1
  exit 0
fi

session=$(jq -r '.session_id // "none"' <<<"$input" 2>/dev/null)
stamp="${TMPDIR:-/tmp}/oppenheimer-biome-missing-${session//[^A-Za-z0-9_-]/}"
[[ -e "$stamp" ]] && exit 0
: >"$stamp" 2>/dev/null
message='Biome is not installed (no node_modules/.bin/biome), so edits are not being formatted. Run `pnpm install --frozen-lockfile`.'
jq -cn --arg m "$message" \
  '{systemMessage: $m, hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $m}}'
exit 0
