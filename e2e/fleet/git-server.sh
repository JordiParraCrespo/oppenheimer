#!/bin/bash
# The fleet's GitHub for git: bare repositories named and branched the way
# `support/github-stub.ts` lists them, served read-write over git://.
set -euo pipefail
root=/tmp/git
seed() {
  local full_name=$1; shift
  local bare="$root/$full_name.git" work
  work=$(mktemp -d)
  git -C "$work" init -q -b "$1"
  printf '# %s\n' "$full_name" > "$work/README.md"
  git -C "$work" add README.md
  git -C "$work" commit -q -m "Initial commit"
  for branch in "${@:2}"; do git -C "$work" branch "$branch"; done
  mkdir -p "$(dirname "$bare")"
  git clone -q --bare "$work" "$bare"
  git -C "$bare" config daemon.receivepack true
  rm -rf "$work"
}
seed acme-labs/xrp-mobile main release/2026-09 fix/wallet-empty-state
seed acme-labs/xrp-web trunk next
exec git daemon --reuseaddr --export-all --enable=receive-pack --base-path="$root" "$root"
