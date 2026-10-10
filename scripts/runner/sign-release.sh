#!/usr/bin/env bash
# Sign a release manifest with the offline Ed25519 key, and mint that key the
# first time. `openssl` is the only tool needed, so the key can live on a
# machine that has nothing else installed and never touches CI.
#
#   scripts/runner/sign-release.sh --keygen release.key   # once, offline
#   scripts/runner/sign-release.sh dist/runner/stable.json release.key
#
# The second form writes <manifest>.sig, the base64 detached signature the
# runner verifies against the public key compiled into it.
#
# It is also the one place the publishing side checks keys and signatures:
# release.sh validates RELEASE_PUBLIC_KEYS with --check-keys, and publish-dev.sh
# and `oppctl publish-release` (which installs a copy beside itself) verify a
# manifest with --verify. The check is the installer's verify_manifest
# (scripts/runner/install.sh), which has to stay standalone; publish.test.mjs
# runs both on the same manifests so they cannot drift apart.
set -euo pipefail

usage() {
	cat <<EOF
usage:
  sign-release.sh --keygen <key file>      generate the offline signing key
  sign-release.sh --pubkey <key file>      print the public key to compile in
  sign-release.sh <manifest.json> <key file>
  sign-release.sh --check-keys "<keys>"    exit 0 when every key is a base64 Ed25519 key
  sign-release.sh --verify <manifest.json> <signature file> "<keys>"
                                           exit 0 when one of the keys signed the manifest
EOF
}

# OpenSSL 3 is the first that verifies Ed25519 over raw bytes; OPENSSL picks one
# that is not first on the PATH (macOS ships LibreSSL as `openssl`).
openssl() { command "${OPENSSL:-openssl}" "$@"; }

# A raw Ed25519 public key is 32 bytes: 44 base64 characters ending in '='.
check_keys() {
	local key n=0
	for key in $1; do
		[[ "$key" =~ ^[A-Za-z0-9+/]{43}=$ ]] || {
			echo "\"$key\" is not a base64 Ed25519 public key" >&2
			return 1
		}
		n=$((n + 1))
	done
	[ "$n" -gt 0 ] || { echo "no release keys" >&2; return 1; }
}

# The installer's verify_manifest: an Ed25519 SubjectPublicKeyInfo is a fixed
# 12-byte header and the raw key, and the header is exactly 16 base64
# characters, so the PEM is the header and the key concatenated.
verify() {
	local manifest="$1" signature="$2" keys="$3" work key rc=1
	check_keys "$keys" || return 1
	work="$(mktemp -d)"
	if openssl base64 -d -A -in "$signature" -out "$work/sig.bin" 2>/dev/null && [ -s "$work/sig.bin" ]; then
		for key in $keys; do
			printf -- '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA%s\n-----END PUBLIC KEY-----\n' "$key" >"$work/release.pub"
			if openssl pkeyutl -verify -pubin -inkey "$work/release.pub" -rawin \
				-in "$manifest" -sigfile "$work/sig.bin" >/dev/null 2>&1; then
				rc=0
				break
			fi
		done
	fi
	rm -rf "$work"
	return "$rc"
}

# The compiled-in form is the raw 32-byte public key, base64. openssl prints
# it inside a DER SubjectPublicKeyInfo whose last 32 bytes are the key.
public_key() { openssl pkey -in "$1" -pubout -outform DER | tail -c 32 | base64 | tr -d '\n'; }

case "${1:-}" in
--keygen)
	key="${2:?usage: sign-release.sh --keygen <key file>}"
	[ ! -e "$key" ] || { echo "refusing to overwrite $key" >&2; exit 1; }
	( umask 077 && openssl genpkey -algorithm ed25519 -out "$key" )
	echo "wrote $key — keep it offline, it is the only thing that can authorise an update"
	echo "public key (compile this in): $(public_key "$key")"
	;;
--pubkey)
	public_key "${2:?usage: sign-release.sh --pubkey <key file>}"
	echo
	;;
--check-keys)
	check_keys "${2-}"
	;;
--verify)
	[ $# -eq 4 ] || { usage >&2; exit 2; }
	verify "$2" "$3" "$4"
	;;
-h | --help | "")
	usage
	;;
*)
	manifest="$1"
	key="${2:?usage: sign-release.sh <manifest.json> <key file>}"
	openssl pkeyutl -sign -inkey "$key" -rawin -in "$manifest" -out "$manifest.sig.bin"
	base64 <"$manifest.sig.bin" | tr -d '\n' >"$manifest.sig"
	rm -f "$manifest.sig.bin"
	echo "wrote $manifest.sig"
	;;
esac
