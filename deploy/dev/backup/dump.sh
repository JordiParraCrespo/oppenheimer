#!/bin/sh
# Vendored from JordiParraCrespo/indie-hacker-agents-claude-skills
# (.claude/skills/db-backup-verify/scripts/dump.sh at dfc86c7), plus one fix not
# yet upstream: it reads PGPASSWORD_FILE itself, since libpq has no such
# variable.
# Fix it there, then copy it here again.
# dump.sh — runs in the dump sidecar: the container WITH database access and
# WITHOUT internet.
#
# POSIX sh, because this runs in an alpine-based image that has no bash.
#
#   pg_dump -Fc  ->  age encrypt  ->  checksum  ->  atomic publish
#
# WHY ENCRYPT HERE
#
# Splitting dump and upload into two containers looks like it separates
# capabilities — one can read the database, the other can reach the internet.
# It doesn't, on its own: the uploader has to READ the dump to upload it, and
# the dump is every row in the database. Unencrypted, the uploader ends up
# holding complete customer data plus egress, which is exactly the combination
# the split was meant to prevent.
#
# Encrypting to a public key here is what makes the separation real. The
# uploader only ever handles ciphertext. It also means a compromised R2 *or* B2
# account yields ciphertext rather than your database.
#
# The private key never exists on this host. It lives offline and is supplied to
# the restore drill at run time.

set -eu

: "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}"
: "${AGE_RECIPIENT:?set AGE_RECIPIENT to the age public key (age1...)}"

WORKDIR="${WORKDIR:-/work}"
STAGING="$WORKDIR/staging"
OUTBOX="$WORKDIR/outbox"
RETAIN_LOCAL_DAYS="${RETAIN_LOCAL_DAYS:-3}"

log() { printf '[dump] %s\n' "$*" >&2; }
die() { printf '[dump] FAIL %s\n' "$*" >&2; exit 1; }

# libpq reads PGPASSWORD but has no PGPASSWORD_FILE, and pg_dump runs with
# --no-password below, so a Docker secret has to be read in here. Exported to
# this process and pg_dump only, never set on the container.
if [ -n "${PGPASSWORD_FILE:-}" ]; then
  [ -r "$PGPASSWORD_FILE" ] || die "cannot read PGPASSWORD_FILE ($PGPASSWORD_FILE)"
  PGPASSWORD="$(cat "$PGPASSWORD_FILE")"
  export PGPASSWORD
fi

command -v pg_dump >/dev/null || die "pg_dump not found"
command -v age     >/dev/null || die "age not found — install it in the sidecar image"

mkdir -p "$STAGING" "$OUTBOX"

# STAGING and OUTBOX must be on the same filesystem: publishing relies on
# rename(2) being atomic, which is only guaranteed within a filesystem. A
# cross-device mv degrades to copy-then-delete, which reintroduces exactly the
# torn-file window this is designed to close.
[ "$(stat -c %d "$STAGING")" = "$(stat -c %d "$OUTBOX")" ] \
  || die "staging and outbox are on different filesystems — atomic publish impossible"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BASE="${PGDATABASE}-${TS}.pgc.age"
TMP_PLAIN="$STAGING/${PGDATABASE}-${TS}.pgc"
TMP_ENC="$STAGING/$BASE"
TMP_SUM="$STAGING/$BASE.sha256"

cleanup() { rm -f "$TMP_PLAIN"; }
trap cleanup EXIT INT TERM

log "dumping $PGDATABASE from $PGHOST"
pg_dump -Fc --no-password -f "$TMP_PLAIN" || die "pg_dump failed"

# A zero-byte or absurdly small dump usually means pg_dump "succeeded" against
# an empty or wrong database. Uploading that would put a useless object under a
# 30-day bucket lock, where it cannot be deleted.
SIZE="$(wc -c < "$TMP_PLAIN")"
[ "$SIZE" -gt "${MIN_DUMP_BYTES:-1024}" ] || die "dump is only ${SIZE} bytes — refusing to publish"
log "dump ok (${SIZE} bytes)"

log "encrypting to $AGE_RECIPIENT"
age -r "$AGE_RECIPIENT" -o "$TMP_ENC" "$TMP_PLAIN" || die "age encryption failed"
rm -f "$TMP_PLAIN"

# Sanity check: an age file starts with a known header. If encryption silently
# produced something else, better to find out now than during a restore.
head -c 20 "$TMP_ENC" | grep -q 'age-encryption' || die "output does not look like an age file"

( cd "$STAGING" && sha256sum "$BASE" > "$BASE.sha256" ) || die "checksum failed"

# ---- atomic publish -------------------------------------------------------
# Order matters. The checksum moves FIRST, the payload SECOND, so that the
# presence of the .age file in the outbox implies its .sha256 is already there.
# The uploader keys off the .age file, so it can never observe a payload whose
# checksum hasn't landed yet.
#
# Both moves are renames within one filesystem, so a reader sees each file
# either absent or complete — never half-written. Without this, a scheduled
# uploader can catch a dump mid-write and ship a truncated object, which the
# bucket lock then preserves as immutable for 30 days, possibly as the newest
# dump a real restore reaches for.
mv "$TMP_SUM" "$OUTBOX/$BASE.sha256"
mv "$TMP_ENC" "$OUTBOX/$BASE"
log "published $OUTBOX/$BASE"

# Local copies are a convenience, not the backup. Prune old ones so a full disk
# doesn't take the database down with it.
find "$OUTBOX" -name '*.pgc.age' -type f -mtime "+$RETAIN_LOCAL_DAYS" -print -delete 2>/dev/null | while read -r f; do
  log "pruned local $f"; rm -f "$f.sha256"
done

log "done"
