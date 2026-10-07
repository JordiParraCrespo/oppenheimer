#!/bin/sh
# Vendored from JordiParraCrespo/indie-hacker-agents-claude-skills
# (.claude/skills/db-backup-verify/scripts/upload.sh at dfc86c7), plus one fix not
# yet upstream: it verifies the upload against the prefix, since `rclone
# check` refuses an object path.
# Fix it there, then copy it here again.
# upload.sh — runs in the uploader: the container WITH internet and WITHOUT
# database access. It only ever sees ciphertext.
#
#   upload.sh daily    publish new dumps to R2 (primary)
#   upload.sh weekly   additionally copy to B2 (secondary vendor)
#   upload.sh check    report freshness without transferring anything
#
# The uploader deliberately holds no database credentials. If it is compromised,
# the attacker gets age-encrypted blobs and two object-store tokens that cannot
# delete anything protected by a lock.

set -eu

WORKDIR="${WORKDIR:-/work}"
OUTBOX="$WORKDIR/outbox"
STATE="$WORKDIR/.uploaded"

R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:?set R2_BUCKET}"
R2_PREFIX="${R2_PREFIX:-postgres/}"
B2_REMOTE="${B2_REMOTE:-b2}"
B2_BUCKET="${B2_BUCKET:-}"
B2_PREFIX="${B2_PREFIX:-postgres/}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-26}"

log() { printf '[upload] %s\n' "$*" >&2; }
die() { printf '[upload] FAIL %s\n' "$*" >&2; exit 1; }

command -v rclone >/dev/null || die "rclone not found"
mkdir -p "$OUTBOX"; touch "$STATE"

# Only files that completed the atomic publish are candidates: a .age payload
# whose .sha256 is already present. The dump sidecar moves the checksum first
# precisely so this test is sufficient.
candidates() {
  find "$OUTBOX" -maxdepth 1 -name '*.pgc.age' -type f 2>/dev/null | sort | while read -r f; do
    [ -f "$f.sha256" ] || { log "skipping $f — checksum not published yet"; continue; }
    grep -Fqx "$(basename "$f")" "$STATE" && continue
    printf '%s\n' "$f"
  done
}

verify_local() {
  d="$(dirname "$1")"; b="$(basename "$1")"
  ( cd "$d" && sha256sum -c "$b.sha256" >/dev/null 2>&1 ) \
    || die "local checksum mismatch for $b — refusing to upload a corrupt object"
}

# Verifying the remote copy matters more here than usual: once an object lands
# under a bucket lock it cannot be deleted or overwritten for the retention
# period, so a bad upload is permanent. rclone's own hash check is cheap
# compared to discovering the problem during a restore.
push() {
  remote="$1"; bucket="$2"; prefix="$3"; file="$4"; name="$(basename "$file")"
  log "-> $remote:$bucket/$prefix$name"
  rclone copyto --checksum "$file" "$remote:$bucket/$prefix$name" \
    || die "upload to $remote failed"
  rclone copyto --checksum "$file.sha256" "$remote:$bucket/$prefix$name.sha256" \
    || die "checksum upload to $remote failed"
  # The destination is the prefix, not the object: `rclone check` compares
  # directories and refuses an object path ("is a file not a directory"). A
  # file as the source limits the comparison to that one file.
  rclone check --one-way --checksum "$file" "$remote:$bucket/$prefix" >/dev/null 2>&1 \
    || die "post-upload verification failed for $remote:$bucket/$prefix$name"
  log "verified on $remote"
}

cmd_daily() {
  n=0
  for f in $(candidates); do
    verify_local "$f"
    push "$R2_REMOTE" "$R2_BUCKET" "$R2_PREFIX" "$f"
    basename "$f" >> "$STATE"
    n=$((n + 1))
  done
  [ "$n" -gt 0 ] || log "nothing new to upload"
  cmd_check
}

cmd_weekly() {
  [ -n "$B2_BUCKET" ] || die "B2_BUCKET unset — the second vendor is what protects you from a compromised Cloudflare account, not an optional extra"
  newest="$(find "$OUTBOX" -maxdepth 1 -name '*.pgc.age' -type f 2>/dev/null | sort | tail -1)"
  [ -n "$newest" ] || die "no local dump to copy to B2"
  verify_local "$newest"
  push "$B2_REMOTE" "$B2_BUCKET" "$B2_PREFIX" "$newest"
}

# Freshness is checked against the REMOTE, not the local outbox. A local file
# proves the dump ran; only the remote proves the backup exists somewhere the
# server burning down wouldn't take with it.
cmd_check() {
  newest_remote="$(rclone lsf --files-only "$R2_REMOTE:$R2_BUCKET/$R2_PREFIX" 2>/dev/null \
                    | grep '\.pgc\.age$' | sort | tail -1 || true)"
  [ -n "$newest_remote" ] || die "no dump found in $R2_REMOTE:$R2_BUCKET/$R2_PREFIX"

  # Timestamp is embedded in the filename (…-YYYYmmddTHHMMSSZ.pgc.age), so this
  # works without trusting object metadata or the local clock's timezone.
  stamp="$(printf '%s' "$newest_remote" | sed -n 's/.*-\([0-9]\{8\}T[0-9]\{6\}Z\)\.pgc\.age$/\1/p')"
  [ -n "$stamp" ] || die "cannot parse a timestamp from '$newest_remote'"

  epoch="$(date -u -d "$(printf '%s' "$stamp" | sed 's/T/ /; s/Z//; s/\(....\)\(..\)\(..\) \(..\)\(..\)\(..\)/\1-\2-\3 \4:\5:\6/')" +%s 2>/dev/null || echo 0)"
  now="$(date -u +%s)"
  age_h=$(( (now - epoch) / 3600 ))

  log "newest remote dump: $newest_remote (${age_h}h old)"
  [ "$age_h" -le "$MAX_AGE_HOURS" ] \
    || die "newest backup is ${age_h}h old, threshold is ${MAX_AGE_HOURS}h"
  log "freshness ok"
}

case "${1:-daily}" in
  daily)  cmd_daily ;;
  weekly) cmd_weekly ;;
  check)  cmd_check ;;
  *) printf 'usage: %s {daily|weekly|check}\n' "$(basename "$0")" >&2; exit 2 ;;
esac
