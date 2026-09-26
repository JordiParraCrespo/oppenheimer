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
set -euo pipefail

usage() {
	cat <<EOF
usage:
  sign-release.sh --keygen <key file>      generate the offline signing key
  sign-release.sh --pubkey <key file>      print the public key to compile in
  sign-release.sh <manifest.json> <key file>
EOF
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
