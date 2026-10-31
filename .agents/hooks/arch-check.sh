#!/usr/bin/env bash
# Stop hook: enforce the architecture boundaries before a task ends. Runs
# dependency-cruiser for the API (apps/api/ARCHITECTURE.md) and for each
# frontend package (packages/frontend/ARCHITECTURE.md, the apps'
# ARCHITECTURE.md) whose source has uncommitted changes, plus the API and
# frontend layout contracts for the side that changed, and blocks the stop
# with the violations so they get fixed in-loop. `pnpm ci:local` still runs
# all of `pnpm arch`.
#
# It calls depcruise itself rather than `pnpm arch`: turbo's `^build` in
# front of it costs minutes on a checkout with nothing built, and the rules
# only need the workspace packages' `dist/` to exist so their imports
# resolve to `packages/<name>/`. When one a package reaches has never been
# built, that package goes through `pnpm turbo run arch --filter`, which
# builds it first. A package that passed is not cruised again until its
# changes do.
set -uo pipefail
input=$(cat)

# Avoid infinite loops: if we already blocked once this turn, allow the stop.
if echo "$input" | jq -e '.stop_hook_active == true' >/dev/null 2>&1; then
  exit 0
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$repo_root" || exit 0

# Each package with a depcruise config, then the paths whose change re-runs
# it. (A plain list: macOS ships bash 3.2, which has no associative arrays.)
watch=(
  "apps/api apps/api/src apps/api/.dependency-cruiser.cjs"
  # oppenheimer:begin web
  "packages/frontend/core packages/frontend/core packages/tsconfig/depcruise"
  "packages/frontend/consumer packages/frontend/consumer packages/tsconfig/depcruise"
  "packages/frontend/web packages/frontend/web packages/tsconfig/depcruise"
  "apps/web apps/web packages/tsconfig/depcruise"
  # oppenheimer:end web
)

# shellcheck disable=SC2086
changed() { [[ -n $(git status --porcelain -- $1 2>/dev/null) ]]; }

api_changed=false
frontend_changed=false
changed "apps/api/src" && api_changed=true
# oppenheimer:begin web
changed "apps/web" && frontend_changed=true
# oppenheimer:end web
changed "packages/frontend" && frontend_changed=true
[[ "$api_changed" == false && "$frontend_changed" == false ]] && exit 0

depcruise="$repo_root/node_modules/.bin/depcruise"
if [[ ! -x "$depcruise" ]]; then
  jq -n '{systemMessage: "Architecture check skipped: dependency-cruiser is not installed (run `pnpm install --frozen-lockfile`)."}'
  exit 0
fi

state="$(git rev-parse --absolute-git-dir)/arch-check"
mkdir -p "$state" 2>/dev/null

# A fingerprint of a package's uncommitted state: HEAD, the diff, and the
# content of every untracked file.
fingerprint() {
  # shellcheck disable=SC2086
  {
    git rev-parse HEAD
    git diff HEAD -- $1
    git ls-files --others --exclude-standard -z -- $1 | xargs -0r git hash-object --
  } 2>/dev/null | git hash-object --stdin
}

# Exits non-zero when a workspace package the package reaches, directly or
# through another, builds to a `dist/` that is not there yet.
deps_built() {
  node - "$1" <<'NODE'
const { existsSync, readFileSync, realpathSync } = require('node:fs');
const { join } = require('node:path');
const seen = new Set();
const walk = (dir) => {
  if (seen.has(dir)) return true;
  seen.add(dir);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  if (seen.size > 1 && pkg.scripts?.build && JSON.stringify([pkg.exports, pkg.main]).includes('dist/') && !existsSync(join(dir, 'dist'))) return false;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  for (const [name, range] of Object.entries(deps)) {
    if (!String(range).startsWith('workspace:')) continue;
    let target;
    try { target = realpathSync(join(dir, 'node_modules', name)); } catch { return false; }
    if (!walk(target)) return false;
  }
  return true;
};
process.exit(walk(realpathSync(process.argv[2])) ? 0 : 1);
NODE
}

output=""
status=0
unbuilt=()
runs=$(mktemp -d)
trap 'rm -rf "$runs"' EXIT
# The packages cruise in parallel; each leaves its output in `$runs/<n>.out`
# and, on a violation, a `$runs/<n>.failed`.
n=0
for entry in "${watch[@]}"; do
  pkg=${entry%% *}
  paths=${entry#* }
  [[ -f "$pkg/.dependency-cruiser.cjs" ]] || continue
  changed "$paths" || continue
  key=$(fingerprint "$paths")
  stamp="$state/${pkg//\//_}"
  [[ -f "$stamp" && "$(cat "$stamp")" == "$key" ]] && continue
  if ! deps_built "$pkg" 2>/dev/null; then
    unbuilt+=("$pkg")
    continue
  fi
  n=$((n + 1))
  (
    cd "$pkg" || exit 0
    if "$depcruise" src --config .dependency-cruiser.cjs >"$runs/$n.out" 2>&1; then
      printf '%s' "$key" >"$stamp"
    else
      printf '%s\n' "$pkg" >"$runs/$n.failed"
    fi
  ) &
done
wait
for failed in "$runs"/*.failed; do
  [[ -f "$failed" ]] || continue
  status=1
  output+="$(cat "$failed")"$'\n'"$(cat "${failed%.failed}.out")"$'\n\n'
done

if [[ -n "${unbuilt[*]:-}" ]]; then
  filters=()
  for pkg in "${unbuilt[@]}"; do filters+=("--filter=./$pkg"); done
  result=$(pnpm turbo run arch --output-logs=errors-only "${filters[@]}" 2>&1) || {
    status=1
    output+="$result"$'\n\n'
  }
fi

if [[ "$api_changed" == true && -f scripts/check-api-structure.mjs ]]; then
  api_structure=$(node scripts/check-api-structure.mjs 2>&1) || {
    status=1
    output+="$api_structure"$'\n\n'
  }
fi

if [[ "$frontend_changed" == true && -f scripts/check-frontend-structure.mjs ]]; then
  structure=$(node scripts/check-frontend-structure.mjs 2>&1) || {
    status=1
    output+="$structure"$'\n\n'
  }
fi

if [[ "$status" -ne 0 ]]; then
  reason=$(printf 'Architecture check failed. Fix these boundary violations before finishing — see the ARCHITECTURE.md of what you changed:\n\n%s' "$output")
  jq -n --arg r "$reason" '{decision: "block", reason: $r}'
fi
exit 0
