# shellcheck shell=bash
# `oppctl publish-release`: put a signed runner release where hosts install and
# update from. Sourced by oppctl, which owns the helpers it uses (die, ok,
# lock, compose, wait_healthy, verify_release, current_release), and installed
# beside it by `oppctl setup` with scripts/runner/sign-release.sh, the one
# signature and key check on the publishing side.
#
# Layout, served read-only by the `releases` container:
#
#   public/.releases/<stamp>-<version>/   one set per publish: install.sh, the
#                                         channel manifests, their .sig, the
#                                         artifacts, SHA256SUMS
#   public/releases   → .releases/<set>   the live set (a relative symlink, so
#                                         it resolves inside the container too)
#   public/install.sh → releases/install.sh
#
# The installer lives in the set, so one rename of `public/releases` publishes
# the installer, the manifests, their signatures and the artifacts together. A
# publish assembles the next set beside the live one, checks that whole set,
# then swaps; if the API does not come back, it swaps back. The tunnel routes
# only /releases/ and /install.sh, so the sets themselves are not reachable.

PUBLIC="$ROOT/public"
RELEASE_SETS="$PUBLIC/.releases"
KEEP_RELEASE_SETS=3
# What stdin may carry. Past it the publish fails rather than reading a cut
# archive: four static binaries and a few small files are far below.
PUBLISH_MAX_BYTES=500000000

# sign-release.sh: beside this file once installed, in the checkout otherwise.
sign_release() {
  local here bin
  here="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
  for bin in "$here/sign-release.sh" "$here/../../../scripts/runner/sign-release.sh"; do
    [ -x "$bin" ] && { OPENSSL="$PUBLISH_OPENSSL" "$bin" "$@"; return; }
  done
  die "no sign-release.sh beside $here; re-run 'oppctl setup' from a checkout"
}

# An OpenSSL that can verify Ed25519 over raw bytes (3.x), found the way the
# installer finds one. Ubuntu's is; macOS's LibreSSL, where tests may run, is not.
release_openssl() {
  local candidate
  for candidate in openssl /opt/homebrew/opt/openssl@3/bin/openssl /usr/local/opt/openssl@3/bin/openssl; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" version 2>/dev/null | grep -q '^OpenSSL 3'; then
      printf '%s' "$candidate"; return 0
    fi
  done
  return 1
}

file_sha256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }

# The release keys stamped into an installer (scripts/runner/release.sh).
installer_keys() { sed -n 's/^RELEASE_PUBLIC_KEYS="\([^"]*\)"$/\1/p' "$1" | head -n1; }

# check_set <dir> <incoming channels> [--new-keys] — the whole candidate set,
# as hosts would see it after the swap: an installer carrying release keys;
# every manifest in the set (the incoming ones and any carried over) signed by
# one of those keys, so the installer accepts every live channel; the incoming
# ones also signed by a key of the installer already published, so the hosts
# in the field take the update; every artifact a manifest names present with
# its digest and size, on this server's /releases; and nothing else.
check_set() {
  local dir="$1" incoming="$2" new_keys="${3:-}" keys live_keys f channel manifests="" name file url want got size
  local base="https://$DEV_HOSTNAME/releases"
  local expected=" install.sh SHA256SUMS "

  [ -d "$dir" ] || die "no such directory: $dir"
  [ -z "$(find "$dir" -mindepth 1 \( ! -type f -o -path "$dir/*/*" \) -print -quit)" ] \
    || die "the release holds something other than plain files (a directory or a link); refusing"

  [ -s "$dir/install.sh" ] || die "no install.sh in the release; publish the directory release.sh wrote"
  keys="$(installer_keys "$dir/install.sh")"
  [ -n "$keys" ] || die "install.sh carries no release keys, so nothing it installs would be checked; refusing"
  sign_release --check-keys "$keys" || die "install.sh carries release keys that are not base64 Ed25519 public keys"
  live_keys=""
  if [ "$new_keys" != --new-keys ] && [ -s "$PUBLIC/install.sh" ]; then
    live_keys="$(installer_keys "$PUBLIC/install.sh")"
  fi

  for channel in stable beta; do
    [ -e "$dir/$channel.json" ] || continue
    manifests="$manifests $channel"
    expected="$expected$channel.json $channel.json.sig "
    [ -s "$dir/$channel.json.sig" ] || die "$channel.json has no $channel.json.sig; an unsigned manifest is never published"
    if ! sign_release --verify "$dir/$channel.json" "$dir/$channel.json.sig" "$keys"; then
      case " $incoming " in
        *" $channel "*) die "$channel.json.sig does not verify against the keys in install.sh; refusing" ;;
        *) die "the live $channel channel is signed by a key the new install.sh does not carry, so new $channel installs would refuse it. Keep that key in RELEASE_PUBLIC_KEYS until $channel is republished, or publish both channels together" ;;
      esac
    fi
    case " $incoming " in
      *" $channel "*)
        if [ -n "$live_keys" ] && ! sign_release --verify "$dir/$channel.json" "$dir/$channel.json.sig" "$live_keys"; then
          die "$channel.json is not signed by a key the published runners trust ($live_keys), so no host already installed would take it. Sign it with that key, or pass --new-keys to strand them on purpose"
        fi ;;
    esac

    jq -e --arg c "$channel" '.schema == "oppenheimer.release/v1" and .channel == $c
        and (.version | type == "string" and length > 0) and (.artifacts | type == "object" and length > 0)' \
        "$dir/$channel.json" >/dev/null 2>&1 \
      || die "$channel.json is not an oppenheimer.release/v1 manifest for the $channel channel"
    while IFS=$'\t' read -r name url want size; do
      file="${url##*/}"
      [ "$url" = "$base/$file" ] \
        || die "$channel.json points $name at $url, not at $base/ (build it with RELEASE_BASE_URL=$base)"
      [[ "$file" =~ ^runner_[0-9A-Za-z.+-]+_(darwin|linux)_(amd64|arm64)\.tar\.gz$ ]] \
        || die "$channel.json names an artifact this server does not serve: $file"
      [ -f "$dir/$file" ] || die "$channel.json names $file, which is not in the release"
      got="$(file_sha256 "$dir/$file")"
      # A carried channel and an incoming one naming the same file with
      # different bytes (the same version rebuilt) land here too.
      [ "$got" = "$want" ] || die "$file does not match $channel.json: sha256 $got, the manifest signed $want; refusing"
      [ "$(wc -c < "$dir/$file" | tr -d ' ')" = "$size" ] || die "$file is not the size $channel.json signed ($size bytes)"
      expected="$expected$file "
    done < <(jq -r '.artifacts | to_entries[] | [.key, .value.url, .value.sha256, (.value.size | tostring)] | @tsv' "$dir/$channel.json")
    ok "$channel.json $(jq -r .version "$dir/$channel.json") is signed and every artifact matches it"
  done
  [ -n "$manifests" ] || die "no stable.json or beta.json in the release"

  if [ -e "$dir/SHA256SUMS" ]; then
    while read -r want f; do
      f="${f#./}"
      [ -f "$dir/$f" ] && [ "$(file_sha256 "$dir/$f")" = "$want" ] || die "SHA256SUMS disagrees with $f"
    done < "$dir/SHA256SUMS"
  fi
  for f in "$dir"/*; do
    case "$expected" in
      *" ${f##*/} "*) ;;
      *) die "the release has ${f##*/}, which no manifest names; refusing to publish it" ;;
    esac
  done
  ok "install.sh carries the release keys; its sha256 is $(file_sha256 "$dir/install.sh")"
}

# receive_tar <dir> — stdin, a tar of the release's files, into <dir>. Every
# member is checked before anything is extracted: a regular file, named by a
# single path segment, once. A stream past the ceiling is refused, never cut.
receive_tar() {
  local dir="$1" archive="$1.tar" size names types name n=0 seen=" "
  head -c "$((PUBLISH_MAX_BYTES + 1))" > "$archive"
  size="$(wc -c < "$archive" | tr -d ' ')"
  [ "$size" -le "$PUBLISH_MAX_BYTES" ] || die "stdin carries more than $PUBLISH_MAX_BYTES bytes; refusing"
  names="$(tar -tf "$archive" 2>/dev/null)" || die "stdin is not a tar of the release directory"
  types="$(tar -tvf "$archive" 2>/dev/null | cut -c1)" || die "stdin is not a tar of the release directory"
  [ "$(printf '%s\n' "$names" | wc -l)" = "$(printf '%s\n' "$types" | wc -l)" ] || die "could not list the tar on stdin"
  while IFS= read -r name; do
    n=$((n + 1))
    local type; type="$(printf '%s\n' "$types" | sed -n "${n}p")"
    case "$name" in ./ | .) [ "$type" = d ] && continue ;; esac
    name="${name#./}"
    [[ "$name" =~ ^[A-Za-z0-9_+-][A-Za-z0-9._+-]*$ ]] \
      || die "the tar on stdin has a member named \"$name\"; only the release's own files, at its top level, are accepted"
    [ "$type" = - ] || die "the tar on stdin has $name, which is not a regular file; refusing"
    case "$seen" in *" $name "*) die "the tar on stdin has $name twice; refusing" ;; esac
    seen="$seen$name "
  done <<< "$names"
  mkdir -p "$dir"
  tar -xf "$archive" -C "$dir" --no-same-owner --no-same-permissions || die "could not extract the tar on stdin"
  rm -f "$archive"
}

# set_env <file> <KEY> <value> [--if-empty] — rewrite one KEY= line, or append
# it; the file is replaced with a rename and keeps its mode.
set_env() {
  local file="$1" key="$2" value="$3" only_empty="${4:-}" tmp
  if [ "$only_empty" = --if-empty ] && [ -n "$(sed -n "s/^$key=//p" "$file" | tail -n1)" ]; then return 0; fi
  tmp="$(mktemp "$file.XXXXXX")"
  chmod --reference="$file" "$tmp" 2>/dev/null || chmod 0600 "$tmp"
  awk -v k="$key" -v v="$value" 'BEGIN { done = 0 }
    index($0, k "=") == 1 { if (!done) print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }' "$file" > "$tmp"
  mv -f "$tmp" "$file"
}

# point_releases <set name> — the one rename that publishes a set.
point_releases() {
  ln -sfn ".releases/$1" "$PUBLIC/.releases.next"
  mv -Tf "$PUBLIC/.releases.next" "$PUBLIC/releases"
}

# Put the API back on the previous api.env and the link back on the previous
# set, after a publish whose API did not come back.
publish_unwind() {
  local rel="$1" previous="$2"
  warn "the API did not come back healthy; putting the previous release and api.env back"
  if [ -n "$previous" ]; then point_releases "$previous"; else rm -f "$PUBLIC/releases"; fi
  mv -f "$CONFIG/api.env.before-publish" "$CONFIG/api.env"
  compose "$rel" up -d --no-deps --force-recreate api || true
  # oppenheimer:begin web
  compose "$rel" up -d --no-deps --force-recreate web || true
  # oppenheimer:end web
  die "nothing changed: /releases and /install.sh serve ${previous:-nothing} again; see 'oppctl logs api', then publish again"
}

cmd_publish_release() {
  local src="" new_keys="" check_only="" arg
  local usage="usage: oppctl publish-release [--check] [--new-keys] <dir | - for a tar on stdin>"
  for arg in "$@"; do
    case "$arg" in
      --new-keys) new_keys=--new-keys ;;
      --check) check_only=1 ;;
      -) src=- ;;
      -*) die "$usage" ;;
      *) src="$arg" ;;
    esac
  done
  [ -n "$src" ] || die "$usage"
  load_host_env
  [ -n "${DEV_HOSTNAME:-}" ] || die "DEV_HOSTNAME is empty in $CONFIG/host.env"
  PUBLISH_OPENSSL="$(release_openssl)" || die "no OpenSSL 3 here, so a manifest signature cannot be checked"
  if [ -z "$check_only" ]; then lock; fi

  local work f channel incoming="" other live="" previous="" version stamp set
  install -d -m 0755 "$RELEASE_SETS"
  # Beside the live sets, so carrying a channel over is a hard link.
  work="$(mktemp -d "$RELEASE_SETS/.incoming.XXXXXX")"
  # shellcheck disable=SC2064 # the path is fixed now, on purpose
  trap "rm -rf '$work'" EXIT
  if [ "$src" = - ]; then
    [ ! -t 0 ] || die "pipe a tar of the release directory into stdin"
    receive_tar "$work/in"
  else
    [ -d "$src" ] || die "no such directory: $src"
    [ -z "$(find "$src" -mindepth 1 \( ! -type f -o -path "$src/*/*" \) -print -quit)" ] \
      || die "$src holds something other than plain files (a directory or a link); refusing"
    mkdir "$work/in"
    cp -p "$src"/* "$work/in/"
  fi
  for channel in stable beta; do
    [ -e "$work/in/$channel.json" ] && incoming="$incoming $channel"
  done
  [ -n "$incoming" ] || die "no stable.json or beta.json in the release"

  # The candidate: what this publish brings, plus every channel it does not
  # carry, as it is live now. It is checked whole, the way hosts will see it.
  mkdir "$work/set"
  for f in "$work/in"/*; do install -m 0644 "$f" "$work/set/"; done
  live="$(readlink -f "$PUBLIC/releases" 2>/dev/null || true)"
  if [ -L "$PUBLIC/releases" ] && [ -d "$live" ]; then
    previous="${live##*/}"
    for other in stable beta; do
      case " $incoming " in *" $other "*) continue ;; esac
      [ -s "$live/$other.json" ] && [ -s "$live/$other.json.sig" ] || continue
      for f in "$other.json" "$other.json.sig" $(jq -r '.artifacts[].url | sub(".*/"; "")' "$live/$other.json"); do
        # A file the publish brings itself stays; check_set compares its bytes
        # with what the carried manifest signed.
        [ -e "$work/set/$f" ] || [ ! -f "$live/$f" ] || ln "$live/$f" "$work/set/$f" 2>/dev/null || cp -p "$live/$f" "$work/set/$f"
      done
      log "carrying the live $other channel ($(jq -r .version "$live/$other.json")) into the new set"
    done
  fi
  check_set "$work/set" "$incoming" "$new_keys"
  [ -z "$check_only" ] || { ok "would publish (--check: nothing changed)"; return 0; }

  for channel in $incoming; do version="$(jq -r .version "$work/set/$channel.json")"; break; done
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  set="$stamp-$version"
  # Two publishes in one second (two channels of one version) get two sets.
  local n=1
  while [ -e "$RELEASE_SETS/$set" ]; do set="$stamp-$version.$n"; n=$((n + 1)); done
  mv -T "$work/set" "$RELEASE_SETS/$set"

  # The first publish finds the directory `oppctl setup` made and an
  # installer copied by hand: they become a set of their own, the one an
  # unwind returns to, at the cost of a gap of one rename.
  if [ -d "$PUBLIC/releases" ] && [ ! -L "$PUBLIC/releases" ]; then
    previous="$stamp-before-publish"
    mv "$PUBLIC/releases" "$RELEASE_SETS/$previous"
    [ ! -f "$PUBLIC/install.sh" ] || [ -L "$PUBLIC/install.sh" ] || cp -p "$PUBLIC/install.sh" "$RELEASE_SETS/$previous/"
  fi
  point_releases "$set"
  if [ "$(readlink "$PUBLIC/install.sh" 2>/dev/null)" != releases/install.sh ]; then
    ln -sfn releases/install.sh "$PUBLIC/.install.sh.next"
    mv -Tf "$PUBLIC/.install.sh.next" "$PUBLIC/install.sh"
  fi
  ok "published runner $version: /releases and /install.sh → ${set}"

  # The console shows the installer's digest under the install command, and
  # the API reads it from api.env when it starts.
  local digest api_changed=0 rel
  digest="$(file_sha256 "$RELEASE_SETS/$set/install.sh")"
  cp -p "$CONFIG/api.env" "$CONFIG/api.env.before-publish"
  set_env "$CONFIG/api.env" RUNNER_INSTALL_SHA256 "$digest"
  set_env "$CONFIG/api.env" RUNNER_RELEASE_BASE_URL "https://$DEV_HOSTNAME/releases" --if-empty
  set_env "$CONFIG/api.env" RUNNER_INSTALL_URL "https://$DEV_HOSTNAME/install.sh" --if-empty
  cmp -s "$CONFIG/api.env" "$CONFIG/api.env.before-publish" || api_changed=1

  rel="$(current_release)"
  if [ -z "$rel" ]; then
    warn "nothing is deployed yet; the API reads api.env on its first deploy"
  elif [ "$api_changed" = 1 ]; then
    # nginx in web resolves `api` once, when it starts, so it follows the
    # API's new container. Any failure from here puts both things back.
    log "RUNNER_INSTALL_SHA256=$digest; recreating the API (and the console's nginx) so it reads api.env"
    compose "$rel" up -d releases || publish_unwind "$rel" "$previous"
    compose "$rel" up -d --no-deps --force-recreate api || publish_unwind "$rel" "$previous"
    # oppenheimer:begin web
    { wait_healthy "$rel" api && compose "$rel" up -d --no-deps --force-recreate web; } || publish_unwind "$rel" "$previous"
    # oppenheimer:end web
    verify_release "$rel" || publish_unwind "$rel" "$previous"
  fi
  rm -f "$CONFIG/api.env.before-publish"

  # The newest few sets stay, for a look at what was live before; never the
  # live one. Only now, once nothing can need the previous set again.
  find "$RELEASE_SETS" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%f\n' | sort -r | tail -n +$((KEEP_RELEASE_SETS + 1)) \
    | while read -r f; do [ "$f" = "$set" ] || rm -rf "${RELEASE_SETS:?}/$f"; done
  ok "runner $version is live at https://$DEV_HOSTNAME/install.sh"
}
