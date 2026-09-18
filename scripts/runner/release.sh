#!/usr/bin/env bash
# Build the runner's release artifacts for every supported target and write
# the manifest the hosts read. Signing is a separate, offline step:
# scripts/runner/sign-release.sh.
#
#   scripts/runner/release.sh 1.2.3 [stable|beta]
#
# Output, in dist/runner/:
#   runner_<version>_<os>_<arch>.tar.gz   one static binary each
#   SHA256SUMS                            what a person verifies by hand
#   <channel>.json                        the manifest, still unsigned
set -euo pipefail

VERSION="${1:?usage: release.sh <version> [channel]}"
CHANNEL="${2:-stable}"
MIN_SUPPORTED="${MIN_SUPPORTED:-}"
BASE_URL="${RELEASE_BASE_URL:-https://get.oppenheimer.dev/releases}"
# The public half of the offline signing key, compiled into every binary so
# the update path does not depend on the network to know what to trust.
PUBLIC_KEYS="${RELEASE_PUBLIC_KEYS:-}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/dist/runner"
KEYS_VAR="github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/release.PublicKeys"
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"

rm -rf "$OUT"
mkdir -p "$OUT"

if [ -z "$PUBLIC_KEYS" ]; then
	echo "warning: RELEASE_PUBLIC_KEYS is empty — these binaries will refuse every update" >&2
fi

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
