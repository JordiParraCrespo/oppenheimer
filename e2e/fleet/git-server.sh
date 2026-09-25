#!/bin/bash
# The fleet's GitHub for git: bare repositories named and branched the way
# `support/github-stub.ts` lists them, served read-write over git://.
#
# GIT_ROOT is where they live (the container's /tmp/git by default) and
# GIT_LISTEN the address the daemon binds: a host on the machine running the
# suite (`FLEET_HOSTS=local`) keeps it on loopback, since anonymous push is on.
set -euo pipefail
root=${GIT_ROOT:-/tmp/git}
listen=()
if [ -n "${GIT_LISTEN:-}" ]; then listen=(--listen="$GIT_LISTEN"); fi
seed() {
  local full_name=$1; shift
  local bare="$root/$full_name.git" work
  work=$(mktemp -d)
  git -C "$work" init -q -b "$1"
  printf '# %s\n' "$full_name" > "$work/README.md"
  git -C "$work" add README.md
  # An identity of its own: the machine running this may have none configured.
  git -C "$work" -c user.name="Fleet git server" -c user.email="git@fleet.oppenheimer.test" \
    commit -q -m "Initial commit"
  for branch in "${@:2}"; do git -C "$work" branch "$branch"; done
  mkdir -p "$(dirname "$bare")"
  git clone -q --bare "$work" "$bare"
  git -C "$bare" config daemon.receivepack true
  rm -rf "$work"
}
rm -rf "$root"
seed acme-labs/xrp-mobile main release/2026-09 fix/wallet-empty-state
seed acme-labs/xrp-web trunk next
exec git daemon --reuseaddr --export-all --enable=receive-pack ${listen[@]+"${listen[@]}"} --base-path="$root" "$root"
