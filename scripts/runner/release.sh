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
# macOS archives carry the binary inside OppenheimerRunner.app, signed with a
# Developer ID and notarized, because macOS keeps a permission for a signed
# bundle's identity and loses it for a bare binary on every update. That needs
# rcodesign (or RCODESIGN=<path>) and:
#
#   MACOS_SIGN_P12           the Developer ID Application certificate, .p12
#   MACOS_SIGN_P12_PASSWORD  its password (MACOS_SIGN_P12_PASSWORD_FILE works too)
#   MACOS_NOTARY_KEY         an App Store Connect API key, as the JSON file
#                            `rcodesign encode-app-store-connect-api-key` writes
#
# Without them the build stops, unless MACOS_UNSIGNED=1 asks for bundles with
# only the linker's ad-hoc signature: fine to test with, and every Mac that
# installs one asks for its permissions again after each update.
#
# A macOS archive also carries the same binary signed on its own, first, as
# runner_<version>_darwin_<arch>/runner: what a runner up to 0.1.12, which knows
# nothing of the bundle, installs (check_darwin_archive). The version it
# installs then reinstalls itself as the bundle.
#
# Output, in dist/runner/:
#   runner_<version>_<os>_<arch>.tar.gz   one static binary each; on macOS in a
#                                         bundle, with the standalone one beside it
#   SHA256SUMS                            what a person verifies by hand
#   <channel>.json                        the manifest, still unsigned
#   install.sh                            the installer, release keys stamped in
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
"$(cd "$(dirname "$0")" && pwd)/sign-release.sh" --check-keys "$PUBLIC_KEYS" || {
	echo "error: RELEASE_PUBLIC_KEYS must hold base64 Ed25519 public keys (sign-release.sh --pubkey)" >&2
	exit 1
}
# Space-separated on one line: the linker's -X carries one quoted value, and
# the runner's selfupdate.ParsePublicKeys splits the block on any whitespace.
PUBLIC_KEYS="$(printf '%s' "$PUBLIC_KEYS" | tr -s ' \t\n' ' ' | sed 's/^ //; s/ $//')"
case "$BASE_URL" in
https://?*) BASE_URL="${BASE_URL%/}" ;;
"") echo "error: RELEASE_BASE_URL is empty; set it to where hosts will fetch the release, e.g. https://dev.example.com/releases" >&2; exit 1 ;;
*) echo "error: RELEASE_BASE_URL must be https://, got $BASE_URL" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUNDLE="OppenheimerRunner.app"
RCODESIGN="${RCODESIGN:-rcodesign}"
P12_PASSWORD_FILE="${MACOS_SIGN_P12_PASSWORD_FILE:-}"
if [ "${MACOS_UNSIGNED:-}" != 1 ]; then
	missing=""
	[ -n "${MACOS_SIGN_P12:-}" ] || missing="$missing MACOS_SIGN_P12"
	[ -n "${MACOS_SIGN_P12_PASSWORD:-}" ] || [ -n "$P12_PASSWORD_FILE" ] || missing="$missing MACOS_SIGN_P12_PASSWORD"
	[ -n "${MACOS_NOTARY_KEY:-}" ] || missing="$missing MACOS_NOTARY_KEY"
	if [ -n "$missing" ]; then
		echo "error: the macOS bundles cannot be signed and notarized: set$missing." >&2
		echo "       MACOS_UNSIGNED=1 builds them unsigned, and every Mac then asks for its permissions" >&2
		echo "       again after each update." >&2
		exit 1
	fi
	command -v "$RCODESIGN" >/dev/null || { echo "error: $RCODESIGN is not installed; set RCODESIGN=<path>" >&2; exit 1; }
	command -v python3 >/dev/null || { echo "error: python3 is needed to zip the standalone macOS runner for notarization" >&2; exit 1; }
fi
case "$VERSION" in
*[!A-Za-z0-9.+-]*) echo "error: version $VERSION has characters a bundle's Info.plist cannot hold" >&2; exit 1 ;;
esac

PLIST="$ROOT/apps/runner/packaging/macos/Info.plist"
BUNDLE_ID="$(sed -n '/<key>CFBundleIdentifier<\/key>/{n;s/.*<string>\(.*\)<\/string>.*/\1/p;}' "$PLIST")"
[ -n "$BUNDLE_ID" ] || { echo "error: no CFBundleIdentifier in $PLIST" >&2; exit 1; }

p12_password_file() {
	if [ -z "$P12_PASSWORD_FILE" ]; then
		P12_PASSWORD_FILE="$(mktemp)"
		trap 'rm -f "$P12_PASSWORD_FILE"' EXIT
		printf '%s' "$MACOS_SIGN_P12_PASSWORD" >"$P12_PASSWORD_FILE"
	fi
}

# bundle <binary> <dir> — wrap the binary in $BUNDLE under <dir>, then sign
# and notarize it. The ticket is stapled into the bundle, so a Mac checks it
# without asking Apple.
bundle() {
	local app="$2/$BUNDLE"
	mkdir -p "$app/Contents/MacOS"
	mv "$1" "$app/Contents/MacOS/runner"
	sed "s|@VERSION@|$VERSION|g" "$PLIST" >"$app/Contents/Info.plist"
	[ "${MACOS_UNSIGNED:-}" != 1 ] || return 0
	p12_password_file
	"$RCODESIGN" sign --p12-file "$MACOS_SIGN_P12" --p12-password-file "$P12_PASSWORD_FILE" \
		--code-signature-flags runtime "$app"
	# rcodesign gives up after 600 s, and Apple can hold a team's first
	# submissions "In Progress" far longer (runner-v0.1.13 timed out twice).
	"$RCODESIGN" notary-submit --api-key-file "$MACOS_NOTARY_KEY" --max-wait-seconds 3600 --staple "$app"
}

# standalone <binary> — sign the binary on its own, hardened runtime, under the
# bundle's identifier, and notarize it. Apple takes a bare executable only in a
# zip, and a ticket cannot be stapled to one; nothing the runner downloads is
# quarantined, so no Mac asks Apple for it either.
standalone() {
	[ "${MACOS_UNSIGNED:-}" != 1 ] || return 0
	p12_password_file
	"$RCODESIGN" sign --p12-file "$MACOS_SIGN_P12" --p12-password-file "$P12_PASSWORD_FILE" \
		--code-signature-flags runtime --binary-identifier "$BUNDLE_ID" "$1"
	local zip
	zip="$(mktemp -d)/runner.zip"
	python3 -m zipfile -c "$zip" "$1"
	"$RCODESIGN" notary-submit --api-key-file "$MACOS_NOTARY_KEY" --max-wait-seconds 3600 --wait "$zip"
	rm -rf "$(dirname "$zip")"
}

# check_darwin_archive <archive> <dir> — what a runner up to 0.1.12 installs
# from the archive is the first regular file named `runner` in it
# (selfupdate.Unpack at runner-v0.1.12), run on its own. It must be the
# standalone runner, and, signed, carry a signature of its own: hardened
# runtime, and no seal on a bundle's Info.plist or resources, which a file
# outside the bundle can never satisfy and macOS kills it for.
check_darwin_archive() {
	local archive="$1" dir="$2" member tmp info
	# Both reads take the whole listing: a reader that stops early can leave
	# tar on SIGPIPE, which pipefail turns into a silent exit.
	member="$(tar -tvzf "$archive" | awk '!found && $1 ~ /^-/ { n = $NF; sub(/.*\//, "", n); if (n == "runner") { print $NF; found = 1 } }')"
	if [ "$member" != "$dir/runner" ]; then
		echo "error: a runner up to 0.1.12 would install ${member:-nothing} from $archive, not the standalone $dir/runner" >&2
		exit 1
	fi
	[ -n "$(tar -tzf "$archive" | grep -x "$dir/$BUNDLE/Contents/MacOS/runner")" ] ||
		{ echo "error: $archive has no $BUNDLE/Contents/MacOS/runner" >&2; exit 1; }
	[ "${MACOS_UNSIGNED:-}" != 1 ] || return 0
	tmp="$(mktemp -d)"
	tar -xzf "$archive" -C "$tmp" "$member"
	if [ "$(uname -s)" = Darwin ]; then
		codesign --verify --strict --verbose=2 "$tmp/$member" ||
			{ echo "error: $member in $archive does not verify outside the bundle" >&2; exit 1; }
	fi
	info="$("$RCODESIGN" print-signature-info "$tmp/$member")"
	rm -rf "$tmp"
	if ! grep -q 'flags: CodeSignatureFlags(.*RUNTIME' <<<"$info" || ! grep -q '^ *cms:$' <<<"$info" ||
		grep -q "'Resources (3):" <<<"$info" || grep -Eq "'Info \(1\): 0*[1-9a-f]" <<<"$info"; then
		echo "error: $member in $archive is not signed to run on its own (hardened runtime, no bundle seal):" >&2
		grep -E 'flags:|cms|Info \(1\)|Resources \(3\)' <<<"$info" >&2
		exit 1
	fi
}
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
		-ldflags "-s -w -X main.version=${VERSION} -X main.commit=${COMMIT} -X '${KEYS_VAR}=${PUBLIC_KEYS}'" \
		-o "$stage/runner" ./cmd/runner )
	cp "$ROOT/LICENSE" "$stage/" 2>/dev/null || true
	name="runner_${VERSION}_${os}_${arch}"
	archive="$OUT/$name.tar.gz"
	if [ "$os" = darwin ]; then
		cp "$stage/runner" "$stage/runner.standalone"
		bundle "$stage/runner" "$stage"
		mv "$stage/runner.standalone" "$stage/runner"
		standalone "$stage/runner"
		# Named one by one: the standalone runner must come before the
		# bundle's, and a directory's own order is whatever the filesystem says.
		members=("$name/runner" "$name/$BUNDLE")
		[ ! -e "$stage/LICENSE" ] || members+=("$name/LICENSE")
		COPYFILE_DISABLE=1 tar -czf "$archive" -C "$OUT/stage" "${members[@]}"
		check_darwin_archive "$archive" "$name"
	else
		tar -czf "$archive" -C "$OUT/stage" "$name"
	fi
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
echo "==> wrote $OUT/install.sh"
echo "    RUNNER_INSTALL_SHA256=$install_digest"
