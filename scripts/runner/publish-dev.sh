#!/usr/bin/env bash
# Sign the runner release CI built and publish it to the dev deployment, from
# the machine that holds the offline release key.
#
#   DEV_SSH_HOST=oppenheimer-dev DEV_HOSTNAME=dev.example.com \
#     scripts/runner/publish-dev.sh 0.1.0 ~/secure/runner-release.key [stable|beta]
#
# 1. downloads what the `Release runner` workflow attached to the GitHub
#    release runner-v<version>: the artifacts, SHA256SUMS, install.sh and the
#    unsigned <channel>.json. The bytes signed and published are the bytes CI
#    built; nothing is rebuilt here
# 2. signs <channel>.json with scripts/runner/sign-release.sh, here: the
#    private key never leaves this machine, and neither CI nor the server sees it
# 3. streams those files as a tar over SSH to `oppctl publish-release -` on the
#    server, which checks the signature and every digest again, swaps the set
#    in with one rename and points the API at the new installer's digest
#
# DEV_SSH_HOST is the server's tailnet name (the `DEV_SSH_HOST` variable of the
# GitHub `dev` environment); DEV_HOSTNAME is the public hostname hosts fetch
# from, which the workflow's RUNNER_RELEASE_BASE_URL must point at.
# RELEASE_DIR=<dir> publishes a directory release.sh wrote instead of the
# GitHub release. PUBLISH_FLAGS=--new-keys lets the server accept a manifest the
# published runners do not trust, which strands every installed host (a key reset).
set -euo pipefail

usage="usage: publish-dev.sh <version> <release key> [stable|beta]"
VERSION="${1:?$usage}"
KEY="${2:?$usage}"
CHANNEL="${3:-stable}"
SSH_HOST="${DEV_SSH_HOST:?set DEV_SSH_HOST to the server (e.g. oppenheimer-dev)}"
HOSTNAME_PUBLIC="${DEV_HOSTNAME:?set DEV_HOSTNAME to the public hostname (e.g. dev.example.com)}"
SIGN="$(cd "$(dirname "$0")" && pwd)/sign-release.sh"

die() {
	echo "error: $*" >&2
	exit 1
}
[ -r "$KEY" ] || die "cannot read the release key $KEY"
case "$CHANNEL" in
stable | beta) ;;
*) die "unknown channel $CHANNEL; use stable or beta" ;;
esac

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
files=(install.sh SHA256SUMS "$CHANNEL.json")
if [ -n "${RELEASE_DIR:-}" ]; then
	for f in "${files[@]}"; do cp "$RELEASE_DIR/$f" "$work/"; done
	cp "$RELEASE_DIR"/runner_"$VERSION"_*.tar.gz "$work/"
else
	echo "==> downloading runner-v$VERSION from GitHub"
	gh release download "runner-v$VERSION" -D "$work" \
		-p "runner_${VERSION}_*.tar.gz" -p SHA256SUMS -p install.sh -p "$CHANNEL.json"
fi
for f in "${files[@]}"; do [ -s "$work/$f" ] || die "runner-v$VERSION has no $f"; done
jq -e --arg v "$VERSION" --arg c "$CHANNEL" '.version == $v and .channel == $c' "$work/$CHANNEL.json" >/dev/null ||
	die "$CHANNEL.json is not the $CHANNEL manifest of $VERSION"

# The key must be one the installer, and so the binaries, carry: a release
# signed by a key its own runners do not trust installs, then never updates.
SIGNING_PUB="$("$SIGN" --pubkey "$KEY" | tr -d '\n')"
keys="$(sed -n 's/^RELEASE_PUBLIC_KEYS="\([^"]*\)"$/\1/p' "$work/install.sh" | head -n1)"
case " $keys " in
*" $SIGNING_PUB "*) ;;
*) die "runner-v$VERSION was built with RELEASE_PUBLIC_KEYS=\"$keys\", which does not include $KEY's public key ($SIGNING_PUB)" ;;
esac

"$SIGN" "$work/$CHANNEL.json" "$KEY"
"$SIGN" --verify "$work/$CHANNEL.json" "$work/$CHANNEL.json.sig" "$keys" || die "the signature just made does not verify"

echo "==> publishing runner $VERSION ($CHANNEL) to $SSH_HOST"
# COPYFILE_DISABLE keeps macOS's tar from adding AppleDouble entries, which
# the server refuses as files no manifest names.
# shellcheck disable=SC2086 # PUBLISH_FLAGS is a flag list, split on purpose
(cd "$work" && COPYFILE_DISABLE=1 tar -cf - -- *) |
	ssh "admin@$SSH_HOST" sudo -u deploy oppctl publish-release ${PUBLISH_FLAGS:-} -
echo "==> https://$HOSTNAME_PUBLIC/install.sh serves runner $VERSION"
