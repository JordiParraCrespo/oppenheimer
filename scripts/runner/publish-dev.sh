#!/usr/bin/env bash
# Build, sign and publish a runner release to the dev deployment, from the
# machine that holds the offline release key.
#
#   DEV_SSH_HOST=oppenheimer-dev DEV_HOSTNAME=dev.example.com \
#     scripts/runner/publish-dev.sh 0.1.0 ~/secure/runner-release.key [stable|beta]
#
# 1. scripts/runner/release.sh, with the key's public half as RELEASE_PUBLIC_KEYS
#    (or the RELEASE_PUBLIC_KEYS you set, when a second key is being rolled in)
#    and https://$DEV_HOSTNAME/releases as RELEASE_BASE_URL
# 2. scripts/runner/sign-release.sh, here: the private key never leaves this
#    machine, and neither CI nor the server ever sees it
# 3. the signed dist/runner directory, as a tar over SSH, to
#    `oppctl publish-release -` on the server, which checks the signature and
#    every digest again before anything goes live, swaps the files in, sets
#    RUNNER_INSTALL_SHA256 in api.env and restarts the API
#
# DEV_SSH_HOST is the server's tailnet name (the `DEV_SSH_HOST` variable of the
# GitHub `dev` environment); DEV_HOSTNAME is the public hostname hosts fetch
# from. SKIP_BUILD=1 signs and publishes the dist/runner already built;
# PUBLISH_FLAGS=--new-keys lets the server accept a manifest the published
# runners do not trust, which strands every installed host (a key reset).
set -euo pipefail

VERSION="${1:?usage: publish-dev.sh <version> <release key> [stable|beta]}"
KEY="${2:?usage: publish-dev.sh <version> <release key> [stable|beta]}"
CHANNEL="${3:-stable}"
SSH_HOST="${DEV_SSH_HOST:?set DEV_SSH_HOST to the server (e.g. oppenheimer-dev)}"
HOSTNAME_PUBLIC="${DEV_HOSTNAME:?set DEV_HOSTNAME to the public hostname (e.g. dev.example.com)}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/dist/runner"
SIGN="$ROOT/scripts/runner/sign-release.sh"

[ -r "$KEY" ] || { echo "error: cannot read the release key $KEY" >&2; exit 1; }
case "$CHANNEL" in
stable | beta) ;;
*) echo "error: unknown channel $CHANNEL; use stable or beta" >&2; exit 1 ;;
esac

# The key's public half must be among the keys compiled in: a release signed
# by a key its own binaries do not trust installs, then never updates again.
SIGNING_PUB="$("$SIGN" --pubkey "$KEY" | tr -d '\n')"
export RELEASE_PUBLIC_KEYS="${RELEASE_PUBLIC_KEYS:-$SIGNING_PUB}"
case " $RELEASE_PUBLIC_KEYS " in
*" $SIGNING_PUB "*) ;;
*) echo "error: RELEASE_PUBLIC_KEYS does not include $KEY's public key ($SIGNING_PUB)" >&2; exit 1 ;;
esac
export RELEASE_BASE_URL="https://$HOSTNAME_PUBLIC/releases"

if [ "${SKIP_BUILD:-}" != 1 ]; then
	"$ROOT/scripts/runner/release.sh" "$VERSION" "$CHANNEL"
fi
[ -s "$OUT/$CHANNEL.json" ] || { echo "error: no $OUT/$CHANNEL.json to sign" >&2; exit 1; }
jq -e --arg v "$VERSION" '.version == $v' "$OUT/$CHANNEL.json" >/dev/null ||
	{ echo "error: $OUT/$CHANNEL.json is not version $VERSION" >&2; exit 1; }
"$SIGN" "$OUT/$CHANNEL.json" "$KEY"

# Only the files a release consists of, without the AppleDouble entries and
# extended attributes macOS's tar would otherwise add.
files=(install.sh install.env SHA256SUMS "$CHANNEL.json" "$CHANNEL.json.sig")
for f in "$OUT"/runner_"$VERSION"_*.tar.gz; do files+=("${f##*/}"); done
tar_flags=()
if tar --version 2>/dev/null | grep -q bsdtar; then tar_flags=(--no-mac-metadata); fi

echo "==> publishing runner $VERSION ($CHANNEL) to $SSH_HOST"
# PUBLISH_FLAGS=--new-keys is for a deliberate key reset (see oppctl), split on purpose.
# shellcheck disable=SC2086
COPYFILE_DISABLE=1 tar ${tar_flags[@]+"${tar_flags[@]}"} -cf - -C "$OUT" "${files[@]}" |
	ssh "admin@$SSH_HOST" sudo -u deploy oppctl publish-release ${PUBLISH_FLAGS:-} -
echo "==> https://$HOSTNAME_PUBLIC/install.sh serves runner $VERSION"
