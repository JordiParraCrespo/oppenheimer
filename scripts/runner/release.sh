#!/usr/bin/env bash
# Build the runner's release artifacts for every supported target and write
# the manifest the hosts read. Signing is a separate, offline step:
# scripts/runner/sign-release.sh.
#
#   RELEASE_PUBLIC_KEYS=<key> RELEASE_BASE_URL=https://<host>/releases \
#     scripts/runner/release.sh 1.2.3 [stable|beta]
#
# Both variables are required. RELEASE_PUBLIC_KEYS is the public half of the
# offline key (`sign-release.sh --pubkey`), space-separated when a second one
# is being rolled in; RELEASE_BASE_URL is where the manifest and artifacts
# will be served, which every artifact URL in the manifest is built from.
#
# Output, in dist/runner/:
#   runner_<version>_<os>_<arch>.tar.gz   one static binary each
#   SHA256SUMS                            what a person verifies by hand
#   <channel>.json                        the manifest, still unsigned
#   install.sh                            the installer, release keys stamped in
#   install.env                           RUNNER_INSTALL_SHA256=<installer digest>
set -euo pipefail

VERSION="${1:?usage: release.sh <version> [channel]}"
CHANNEL="${2:-stable}"
MIN_SUPPORTED="${MIN_SUPPORTED:-}"
# Where hosts will fetch from. No default: a manifest whose URLs point at a
# host that does not serve it installs nowhere, and the runner refuses an
# artifact that is not on the release host it was registered with.
BASE_URL="${RELEASE_BASE_URL:-}"
# The public half of the offline signing key, compiled into every binary so
# the update path does not depend on the network to know what to trust.
PUBLIC_KEYS="${RELEASE_PUBLIC_KEYS:-}"

case "$CHANNEL" in
stable | beta) ;;
*) echo "error: unknown channel $CHANNEL; use stable or beta" >&2; exit 1 ;;
esac
if [ -z "$PUBLIC_KEYS" ]; then
	echo "error: RELEASE_PUBLIC_KEYS is empty. Binaries built without a release key refuse every" >&2
	echo "       update; print it with: scripts/runner/sign-release.sh --pubkey <key file>" >&2
	exit 1
fi
for key in $PUBLIC_KEYS; do
	# A raw Ed25519 public key is 32 bytes: 44 base64 characters ending in '='.
	[[ "$key" =~ ^[A-Za-z0-9+/]{43}=$ ]] || {
		echo "error: RELEASE_PUBLIC_KEYS holds \"$key\", which is not a base64 Ed25519 public key" >&2
		exit 1
	}
done
case "$BASE_URL" in
https://?*) BASE_URL="${BASE_URL%/}" ;;
"") echo "error: RELEASE_BASE_URL is empty; set it to where hosts will fetch the release, e.g. https://dev.example.com/releases" >&2; exit 1 ;;
*) echo "error: RELEASE_BASE_URL must be https://, got $BASE_URL" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/dist/runner"
KEYS_VAR="github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/release.PublicKeys"
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"

rm -rf "$OUT"
mkdir -p "$OUT"

targets=("darwin/arm64" "darwin/amd64" "linux/amd64" "linux/arm64")
for target in "${targets[@]}"; do
	os="${target%/*}"
	arch="${target#*/}"
	stage="$OUT/stage/runner_${VERSION}_${os}_${arch}"
	mkdir -p "$stage"
	echo "==> building $target"
	( cd "$ROOT/apps/runner" && CGO_ENABLED=0 GOOS="$os" GOARCH="$arch" go build -trimpath \
		-ldflags "-s -w -X main.version=${VERSION} -X main.commit=${COMMIT} -X ${KEYS_VAR}=${PUBLIC_KEYS}" \
		-o "$stage/runner" ./cmd/runner )
	cp "$ROOT/LICENSE" "$stage/" 2>/dev/null || true
	tar -czf "$OUT/runner_${VERSION}_${os}_${arch}.tar.gz" -C "$OUT/stage" "runner_${VERSION}_${os}_${arch}"
done
rm -rf "$OUT/stage"

( cd "$OUT" && if command -v sha256sum >/dev/null; then sha256sum ./*.tar.gz; else shasum -a 256 ./*.tar.gz; fi ) >"$OUT/SHA256SUMS"

digest() { awk -v f="./$1" '$2 == f { print $1 }' "$OUT/SHA256SUMS"; }
size() { wc -c <"$OUT/$1" | tr -d ' '; }

{
	printf '{"schema":"oppenheimer.release/v1","channel":"%s","version":"%s","releasedAt":"%s","minSupported":"%s","artifacts":{' \
		"$CHANNEL" "$VERSION" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$MIN_SUPPORTED"
	first=1
	for target in "${targets[@]}"; do
		os="${target%/*}"
		arch="${target#*/}"
		file="runner_${VERSION}_${os}_${arch}.tar.gz"
		[ $first -eq 1 ] || printf ','
		first=0
		printf '"%s":{"url":"%s/%s","sha256":"%s","size":%s}' \
			"$target" "$BASE_URL" "$file" "$(digest "$file")" "$(size "$file")"
	done
	printf '}}'
} >"$OUT/$CHANNEL.json"

echo "==> wrote $OUT/$CHANNEL.json"
echo "    sign it offline:  scripts/runner/sign-release.sh $OUT/$CHANNEL.json /path/to/release.key"

# The installer, with the same release keys stamped in, so a first install
# checks the manifest signature against the keys the binaries will trust.
# Its digest is what the console shows beside the install command
# (RUNNER_INSTALL_SHA256), for anyone who reads the script before running it.
sed "s|^RELEASE_PUBLIC_KEYS=\"\"\$|RELEASE_PUBLIC_KEYS=\"$PUBLIC_KEYS\"|" "$ROOT/scripts/runner/install.sh" >"$OUT/install.sh"
if ! grep -q "^RELEASE_PUBLIC_KEYS=\"$PUBLIC_KEYS\"\$" "$OUT/install.sh"; then
	echo "error: could not stamp the release keys into install.sh" >&2
	exit 1
fi
install_digest="$(cd "$OUT" && if command -v sha256sum >/dev/null; then sha256sum install.sh; else shasum -a 256 install.sh; fi | cut -d' ' -f1)"
# The line the control plane's api.env needs, kept for the steps after this
# one (scripts/runner/publish-dev.sh, `oppctl publish-release`).
printf 'RUNNER_INSTALL_SHA256=%s\n' "$install_digest" >"$OUT/install.env"
echo "==> wrote $OUT/install.sh"
echo "    RUNNER_INSTALL_SHA256=$install_digest  (also in $OUT/install.env)"
