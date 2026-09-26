#!/bin/sh
# Oppenheimer runner installer — macOS, Debian and Ubuntu.
#
#   curl --proto '=https' --tlsv1.2 -fsSL https://get.oppenheimer.dev/install.sh |
#     OPPENHEIMER_REGISTRATION_TOKEN=<token> sh -s -- --url https://app.oppenheimer.dev
#
# The token travels in the environment rather than as --token, so it never sits
# in the process list where another account on the machine could read it.
# `--token` still works, for an older install command.
#
# What it does, in order, and nothing else:
#   1. refuses to run as root
#   2. works out this machine's target (darwin/linux x arm64/amd64)
#   3. asks its questions up front — where sessions' code lives, and whether to
#      install git or tmux if one is missing — and installs nothing without a
#      "y" typed on a terminal. With no terminal to ask on (an agent, CI) it
#      installs nothing and stops before the token is spent
#   4. downloads the signed release manifest over HTTPS and, where OpenSSL 3 is
#      available, checks its Ed25519 signature against the release keys stamped
#      into this script (the runner checks every later update itself)
#   5. downloads the artifact and checks its SHA-256 against that manifest
#   6. installs it under ~/.oppenheimer/bin and links `current`
#   7. registers this host — or, when it is already paired to this control
#      plane, keeps that pairing without spending the token
#   8. installs the launchd agent or the systemd user unit and starts it
#
# It is re-runnable: running the same command again repairs a half-finished
# install instead of failing on "already paired".
#
# Everything runs from `main`, called on the last line: a download cut short
# ends before that line, so a partial script defines functions and runs none
# of them. POSIX sh on purpose: macOS ships bash 3.2 and Debian's /bin/sh is dash.
set -eu

# The release keys, base64 raw Ed25519 public keys separated by spaces: the
# current one and the next. scripts/runner/release.sh stamps them into the
# copy it publishes; empty in the repository, where nothing is signed.
RELEASE_PUBLIC_KEYS=""

usage() {
	cat <<EOF
usage: OPPENHEIMER_REGISTRATION_TOKEN=<token> install.sh --url <control plane URL> [options]

  --url         your control plane, e.g. https://app.oppenheimer.dev
  --workspaces  where sessions' code lives (default: ~/oppenheimer-ai/workspaces;
                asked on a terminal when not given)
  --name        a name for this host (default: this machine's hostname)
  --channel     stable (default) or beta
  --release-base
                where the signed manifest and artifacts are served from; your
                control plane puts its own in the command it hands you
  --allow-container
                pair this machine even though it looks like a container or CI job
  --token       the registration token, if it is not in OPPENHEIMER_REGISTRATION_TOKEN

The token is the one-hour, single-use token from Add host.
Nothing is installed with a package manager unless you answer "y" on a terminal.
EOF
}

say() { printf '%s\n' "$*"; }
step() { printf '\033[1m==>\033[0m %s\n' "$*"; }
die() {
	printf '\033[31merror:\033[0m %s\n' "$*" >&2
	exit 1
}

# A terminal to ask on. Under `curl | sh` stdin is this script, so questions go
# to /dev/tty — which exists inside a container too but fails to open there,
# hence the probe rather than a -e test.
has_tty() { (: </dev/tty) 2>/dev/null; }

# ask <question> <default> — the answer, or the default on Enter.
ask() {
	printf '%s\n    [%s] ' "$1" "$2" >/dev/tty
	IFS= read -r reply </dev/tty || reply=""
	printf '%s' "${reply:-$2}"
}

# confirm <question> — true only for a typed y/yes. Enter means no.
confirm() {
	printf '%s [y/N] ' "$1" >/dev/tty
	IFS= read -r reply </dev/tty || reply=""
	case "$reply" in
	[Yy] | [Yy][Ee][Ss]) return 0 ;;
	*) return 1 ;;
	esac
}

# https_or_loopback <url> — HTTPS, or plain HTTP to this machine for development.
https_or_loopback() {
	case "$1" in
	https://?*) return 0 ;;
	http://localhost | http://localhost[:/]* | http://127.0.0.1 | http://127.0.0.1[:/]* | http://\[::1\]*) return 0 ;;
	*) return 1 ;;
	esac
}

# host_of <url> — the host[:port] part, for keeping downloads on the release host.
host_of() { printf '%s' "$1" | sed -n 's|^[a-z]*://\([^/]*\).*|\1|p'; }

# fetch <url> <file> — curl, refusing anything but HTTPS unless the URL is a
# loopback development server, and refusing TLS older than 1.2.
fetch() {
	case "$1" in
	https://*) curl --proto '=https' --tlsv1.2 -fsSL "$1" -o "$2" ;;
	*) curl --proto '=http' -fsSL "$1" -o "$2" ;;
	esac
}

# A tiny JSON read, because the one thing every host has is sed, not jq. The
# manifest is flat and machine-written (scripts/runner/release.sh).
json_field() { sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$2" | head -n1; }

# The artifact entry for a target, as the text inside its braces, whatever
# order its fields come in. `|` delimits because a target contains `/`.
artifact_entry() { tr -d '\n' <"$2" | sed -n "s|.*\"$1\"[[:space:]]*:[[:space:]]*{\([^}]*\)}.*|\1|p"; }
entry_field() { printf '%s' "$2" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"; }

# An OpenSSL that can verify an Ed25519 signature over raw bytes: 3.x. macOS
# ships LibreSSL, which cannot; Homebrew's openssl@3 can, if it is there.
ed25519_openssl() {
	for candidate in openssl /opt/homebrew/opt/openssl@3/bin/openssl /usr/local/opt/openssl@3/bin/openssl; do
		if command -v "$candidate" >/dev/null 2>&1 &&
			"$candidate" version 2>/dev/null | grep -q '^OpenSSL 3'; then
			printf '%s' "$candidate"
			return 0
		fi
	done
	return 1
}

# verify_manifest <openssl> <manifest> <signature file> — 0 if one release key signed it.
verify_manifest() {
	ssl="$1"
	manifest="$2"
	signature="$3"
	"$ssl" base64 -d -A -in "$signature" -out "$WORK/manifest.sig.bin" 2>/dev/null || return 1
	for key in $RELEASE_PUBLIC_KEYS; do
		# An Ed25519 SubjectPublicKeyInfo is a fixed 12-byte header and the raw
		# key; the header is exactly 16 base64 characters, so the two concatenate.
		printf -- '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA%s\n-----END PUBLIC KEY-----\n' "$key" >"$WORK/release.pub"
		if "$ssl" pkeyutl -verify -pubin -inkey "$WORK/release.pub" -rawin \
			-in "$manifest" -sigfile "$WORK/manifest.sig.bin" >/dev/null 2>&1; then
			return 0
		fi
	done
	return 1
}

have_git() { git --version >/dev/null 2>&1; } # not `command -v`: macOS's /usr/bin/git is a stub
have_tmux() { command -v tmux >/dev/null 2>&1; }

# install_cmd <tool> — the exact command, shown before asking and run only
# after a yes. Empty when there is no package manager this script knows.
install_cmd() {
	case "$GOOS" in
	darwin)
		if command -v brew >/dev/null 2>&1; then
			printf 'brew install %s' "$1"
		elif [ "$1" = git ]; then
			printf 'xcode-select --install'
		fi
		;;
	linux)
		if command -v apt-get >/dev/null 2>&1; then
			printf 'sudo apt-get update && sudo apt-get install -y %s' "$1"
		fi
		;;
	esac
}

# ensure_tools — git and tmux, the two sessions cannot start without. Nothing
# is installed without a typed "y"; when one is missing and not installed, the
# install stops here, before the token is spent, so the same command works
# again once it is there.
ensure_tools() {
	missing=""
	have_git || missing="$missing git"
	have_tmux || missing="$missing tmux"
	[ -n "$missing" ] || return 0
	for tool in $missing; do
		step "$tool is missing, and sessions cannot start without it"
		cmd="$(install_cmd "$tool")"
		[ -n "$cmd" ] || die "install $tool with your package manager, then run this command again (the token has not been used)"
		say "    to install it, this would run:  $cmd"
		has_tty || die "there is no terminal to ask on, so nothing was installed. Run that yourself, then run this command again (the token has not been used)"
		confirm "    run it now?" ||
			die "nothing was installed. Install $tool, then run this command again (the token has not been used)"
		sh -c "$cmd"
		# A package manager can succeed without the tool landing on PATH.
		case "$tool" in
		git) have_git ;;
		tmux) have_tmux ;;
		esac || die "$tool is still not available after installing; check your PATH, then run this command again"
	done
}

# choose_workspaces — where sessions' code lives. Asked on a terminal when not
# given; the default otherwise. The runner makes the final checks (it creates
# the directory, proves it writable, resolves symlinks); these are the ones
# worth failing on before anything is downloaded.
choose_workspaces() {
	default="$HOME/oppenheimer-ai/workspaces"
	if [ -z "$WORKSPACES" ] && has_tty; then
		WORKSPACES="$(ask 'Where should session code live on this machine?' "$default")"
	fi
	[ -n "$WORKSPACES" ] || WORKSPACES="$default"
	# A literal tilde, typed at the prompt or quoted in --workspaces, where no
	# shell expanded it; the match is meant to be on the character itself.
	# shellcheck disable=SC2088
	case "$WORKSPACES" in
	"~") WORKSPACES="$HOME" ;;
	"~/"*) WORKSPACES="$HOME/${WORKSPACES#\~/}" ;;
	esac
	case "$WORKSPACES" in
	/*) ;;
	*) die "--workspaces must be an absolute path, got: $WORKSPACES" ;;
	esac
	case "$WORKSPACES/" in
	"$RUNNER_HOME"/*) die "$WORKSPACES is inside $RUNNER_HOME, which holds the runner's own files; choose another directory" ;;
	esac
	case "$WORKSPACES" in
	*/Library/Mobile\ Documents/* | */Library/CloudStorage/* | */Dropbox/* | */Dropbox | */Google\ Drive/* | */OneDrive/*)
		say "warning: $WORKSPACES is in a synced folder; syncing git worktrees while an agent writes to them causes conflicts"
		;;
	esac
	say "    sessions will live in $WORKSPACES"
	# The default is passed as nothing, so the runner keeps treating it as the
	# default rather than a saved choice.
	[ "$WORKSPACES" != "$default" ] || WORKSPACES=""
}

main() {
	RELEASE_BASE="${OPPENHEIMER_RELEASE_BASE:-https://get.oppenheimer.dev/releases}"
	CHANNEL="${OPPENHEIMER_CHANNEL:-stable}"
	CONTROL_PLANE=""
	TOKEN="${OPPENHEIMER_REGISTRATION_TOKEN:-}"
	NAME=""
	WORKSPACES=""
	ALLOW_CONTAINER=""
	RUNNER_HOME="${RUNNER_HOME:-$HOME/.oppenheimer}"

	while [ $# -gt 0 ]; do
		case "$1" in
		--token) TOKEN="${2:-}"; shift 2 ;;
		--url) CONTROL_PLANE="${2:-}"; shift 2 ;;
		--name) NAME="${2:-}"; shift 2 ;;
		--channel) CHANNEL="${2:-}"; shift 2 ;;
		--release-base) RELEASE_BASE="${2:-}"; shift 2 ;;
		--workspaces) WORKSPACES="${2:-}"; shift 2 ;;
		--allow-container) ALLOW_CONTAINER="--allow-container"; shift ;;
		--yes | -y | --no-deps)
			die "$1 is gone: nothing is installed without a \"y\" typed on a terminal. Install git and tmux yourself, or run this from a terminal" ;;
		-h | --help) usage; exit 0 ;;
		*) usage >&2; die "unknown option $1" ;;
		esac
	done
	# Not inherited by anything this script starts except `register`, which
	# gets it explicitly.
	unset OPPENHEIMER_REGISTRATION_TOKEN

	# 1. Never as root. The runner owns the user's sessions and their git
	#    credentials; running it as root would hand the agent the whole machine
	#    and leave every worktree owned by the wrong account.
	[ "$(id -u)" -ne 0 ] || die "run this as the account that will own the sessions, without sudo"
	[ -n "$TOKEN" ] || { usage >&2; die "no registration token: set OPPENHEIMER_REGISTRATION_TOKEN (or pass --token)"; }
	[ -n "$CONTROL_PLANE" ] || { usage >&2; die "--url is required"; }
	https_or_loopback "$CONTROL_PLANE" || die "--url must be https:// (plain http is allowed only to localhost): $CONTROL_PLANE"
	RELEASE_BASE="${RELEASE_BASE%/}"
	https_or_loopback "$RELEASE_BASE" || die "the release base must be https:// (plain http is allowed only to localhost): $RELEASE_BASE"
	case "$CHANNEL" in
	stable | beta) ;;
	*) die "unknown channel $CHANNEL; use stable or beta" ;;
	esac

	# 2. Target.
	OS="$(uname -s)"
	ARCH="$(uname -m)"
	case "$OS" in
	Darwin) GOOS="darwin"; PLATFORM="macOS" ;;
	Linux)
		GOOS="linux"
		PLATFORM="Linux"
		if [ -r /etc/os-release ]; then
			# In a subshell: os-release defines NAME, VERSION and more, and
			# sourcing it here would quietly overwrite this script's own
			# variables — including the host name the user passed in.
			# shellcheck disable=SC1091
			PLATFORM="$(. /etc/os-release && printf '%s' "${PRETTY_NAME:-Linux}")"
			# shellcheck disable=SC1091
			DISTRO="$(. /etc/os-release && printf '%s' "${ID:-}${ID_LIKE:-}")"
			case "$DISTRO" in
			*debian* | *ubuntu*) ;;
			*) say "warning: this distribution is not one the runner is tested on (Debian and Ubuntu are)" ;;
			esac
		fi
		;;
	*) die "$OS is not supported; the runner runs on macOS, Debian and Ubuntu" ;;
	esac
	case "$ARCH" in
	x86_64 | amd64) GOARCH="amd64" ;;
	arm64 | aarch64) GOARCH="arm64" ;;
	*) die "$ARCH is not supported; the runner is built for amd64 and arm64" ;;
	esac
	TARGET="$GOOS/$GOARCH"
	step "installing the Oppenheimer runner on $PLATFORM ($TARGET) as $(id -un)@$(uname -n)"

	for tool in curl tar; do
		command -v "$tool" >/dev/null 2>&1 || die "$tool is needed to install the runner"
	done
	if command -v sha256sum >/dev/null 2>&1; then
		sha256() { sha256sum "$1" | cut -d' ' -f1; }
	elif command -v shasum >/dev/null 2>&1; then
		sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
	else
		die "neither sha256sum nor shasum is available, so a download cannot be verified"
	fi

	# 3. Every question before anything is downloaded, so the rest runs
	#    unattended and a "no" costs nothing.
	choose_workspaces
	ensure_tools

	WORK="$(mktemp -d)"
	trap 'rm -rf "$WORK"' EXIT INT TERM

	# 4. The signed manifest.
	step "fetching the $CHANNEL manifest"
	fetch "$RELEASE_BASE/$CHANNEL.json" "$WORK/manifest.json" ||
		die "could not fetch $RELEASE_BASE/$CHANNEL.json"
	fetch "$RELEASE_BASE/$CHANNEL.json.sig" "$WORK/manifest.json.sig" ||
		die "could not fetch the manifest signature; refusing to install unsigned"
	if [ -z "$RELEASE_PUBLIC_KEYS" ]; then
		say "    note: this copy of the installer carries no release keys (it was not published by"
		say "    scripts/runner/release.sh), so the manifest signature is not checked here"
	elif ssl="$(ed25519_openssl)"; then
		verify_manifest "$ssl" "$WORK/manifest.json" "$WORK/manifest.json.sig" ||
			die "the release manifest's signature does not verify against the release keys.
Stop here and tell us; do not retry with a different mirror."
		say "    signature ok"
	else
		say "    note: no OpenSSL 3 here (macOS ships LibreSSL), so the manifest signature is not"
		say "    checked by this script; it came over HTTPS, and the runner verifies every update itself"
	fi

	VERSION="$(json_field version "$WORK/manifest.json")"
	[ -n "$VERSION" ] || die "the manifest has no version; not installing"
	ENTRY="$(artifact_entry "$TARGET" "$WORK/manifest.json")"
	URL="$(entry_field url "$ENTRY")"
	DIGEST="$(entry_field sha256 "$ENTRY")"
	[ -n "$URL" ] && [ -n "$DIGEST" ] || die "release $VERSION has no build for $TARGET"
	case "$URL" in
	http://* | https://*) ;;
	*) URL="$RELEASE_BASE/${URL#/}" ;;
	esac
	# Only from the release host the command named, and only over HTTPS — the
	# same rule the runner's own updater applies (09 §5).
	https_or_loopback "$URL" || die "the manifest points at $URL, which is not https; not installing"
	[ "$(host_of "$URL")" = "$(host_of "$RELEASE_BASE")" ] ||
		die "the manifest points at $(host_of "$URL"), not the release host $(host_of "$RELEASE_BASE"); not installing"

	# 5. Download and verify.
	step "downloading runner $VERSION"
	fetch "$URL" "$WORK/runner.tar.gz" || die "could not download $URL"
	GOT="$(sha256 "$WORK/runner.tar.gz")"
	if [ "$GOT" != "$DIGEST" ]; then
		rm -f "$WORK/runner.tar.gz"
		die "checksum mismatch: the download is not what the manifest signed.
  expected $DIGEST
  got      $GOT
Stop here and tell us; do not retry with a different mirror."
	fi
	say "    sha256 ok ($DIGEST)"

	# 6. Install under ~/.oppenheimer/bin and link `current`.
	tar -xzf "$WORK/runner.tar.gz" -C "$WORK"
	BINARY="$(find "$WORK" -type f -name runner -perm -u+x | head -n1)"
	[ -n "$BINARY" ] || die "the archive does not contain a runner binary"
	mkdir -p "$RUNNER_HOME/bin" "$HOME/.local/bin"
	chmod 700 "$RUNNER_HOME"
	install -m 700 "$BINARY" "$RUNNER_HOME/bin/runner-$VERSION"
	ln -sfn "runner-$VERSION" "$RUNNER_HOME/bin/current"
	ln -sfn "$RUNNER_HOME/bin/current" "$HOME/.local/bin/oppenheimer-runner"
	RUNNER="$RUNNER_HOME/bin/current"
	if [ "$GOOS" = "darwin" ]; then
		# Until the binary is signed, Gatekeeper quarantines anything curl wrote.
		xattr -d com.apple.quarantine "$RUNNER_HOME/bin/runner-$VERSION" 2>/dev/null || true
	fi
	"$RUNNER" version >/dev/null || die "the installed runner does not start on this machine"
	say "    installed $RUNNER_HOME/bin/runner-$VERSION"

	# 7. Register. The token goes to the runner in its environment, never on a
	#    command line, and is spent there and never written to disk. A host
	#    already paired to this control plane keeps its pairing (--keep-existing),
	#    which is what makes running this command again a repair.
	step "registering with $CONTROL_PLANE"
	set -- --url "$CONTROL_PLANE" --channel "$CHANNEL" --keep-existing
	[ -z "$NAME" ] || set -- "$@" --name "$NAME"
	[ -z "$WORKSPACES" ] || set -- "$@" --workspaces "$WORKSPACES"
	[ -z "$ALLOW_CONTAINER" ] || set -- "$@" "$ALLOW_CONTAINER"
	OPPENHEIMER_REGISTRATION_TOKEN="$TOKEN" "$RUNNER" register "$@"
	TOKEN=""

	# 8. The service.
	step "installing the service"
	"$RUNNER" install

	step "done"
	"$RUNNER" status || true
	say ""
	say "The host should now be online in the console."
	say "  status:    $HOME/.local/bin/oppenheimer-runner status"
	say "  logs:      $RUNNER_HOME/log/runner.log"
	say "  uninstall: $HOME/.local/bin/oppenheimer-runner uninstall"
	case ":$PATH:" in
	*":$HOME/.local/bin:"*) ;;
	*) say ""; say "note: $HOME/.local/bin is not on your PATH; add it to use \`oppenheimer-runner\` by name." ;;
	esac
}

main "$@"
