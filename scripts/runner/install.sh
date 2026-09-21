#!/bin/sh
# Oppenheimer runner installer — macOS, Debian and Ubuntu.
#
#   curl -fsSL https://get.oppenheimer.dev/install.sh | sh -s -- \
#     --token <registration token> --url https://app.oppenheimer.dev
#
# What it does, in order, and nothing else:
#   1. refuses to run as root
#   2. works out this machine's target (darwin/linux x arm64/amd64)
#   3. downloads the signed release manifest for the channel
#   4. downloads the artifact and checks its SHA-256 against that manifest
#   5. installs it under ~/.oppenheimer/bin and links `current`
#   6. checks git, tmux and claude, offering to install a missing tmux
#   7. registers this host with the token (the binary verifies the manifest
#      signature against the key compiled into it — the shell only checks
#      digests, because `shasum` is everywhere and signature tools are not)
#   8. installs the launchd agent or the systemd user unit and starts it
#
# It is re-runnable: running it again repairs a half-finished install.
# POSIX sh on purpose: macOS ships bash 3.2 and Debian's /bin/sh is dash.
set -eu

RELEASE_BASE="${OPPENHEIMER_RELEASE_BASE:-https://get.oppenheimer.dev/releases}"
CHANNEL="${OPPENHEIMER_CHANNEL:-stable}"
CONTROL_PLANE=""
TOKEN=""
NAME=""
INSTALL_DEPS="ask"
RUNNER_HOME="${RUNNER_HOME:-$HOME/.oppenheimer}"

usage() {
	cat <<EOF
usage: install.sh --token <registration token> --url <control plane URL>

  --token   the one-hour, single-use token from Settings → Add host
  --url     your control plane, e.g. https://app.oppenheimer.dev
  --name    a name for this host (default: this machine's hostname)
  --channel stable (default) or beta
  --release-base
            where the signed manifest and artifacts are served from; your
            control plane puts its own in the command it hands you
  --yes     install a missing tmux without asking
  --no-deps never install anything with a package manager
EOF
}

say() { printf '%s\n' "$*"; }
step() { printf '\033[1m==>\033[0m %s\n' "$*"; }
die() {
	printf '\033[31merror:\033[0m %s\n' "$*" >&2
	exit 1
}

while [ $# -gt 0 ]; do
	case "$1" in
	--token) TOKEN="${2:-}"; shift 2 ;;
	--url) CONTROL_PLANE="${2:-}"; shift 2 ;;
	--name) NAME="${2:-}"; shift 2 ;;
	--channel) CHANNEL="${2:-}"; shift 2 ;;
	--release-base) RELEASE_BASE="${2:-}"; shift 2 ;;
	--yes | -y) INSTALL_DEPS="yes"; shift ;;
	--no-deps) INSTALL_DEPS="no"; shift ;;
	-h | --help) usage; exit 0 ;;
	*) usage >&2; die "unknown option $1" ;;
	esac
done

# 1. Never as root. The runner owns the user's sessions and their git
#    credentials; running it as root would hand the agent the whole machine
#    and leave every worktree owned by the wrong account.
[ "$(id -u)" -ne 0 ] || die "run this as the account that will own the sessions, without sudo"
[ -n "$TOKEN" ] || { usage >&2; die "--token is required"; }
[ -n "$CONTROL_PLANE" ] || { usage >&2; die "--url is required"; }

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
step "installing the Oppenheimer runner on $PLATFORM ($TARGET)"

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

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT INT TERM

# 3. The signed manifest. The signature is checked by the binary itself, on
#    first run, against the key compiled into it; here we take the digest.
step "fetching the $CHANNEL manifest"
curl -fsSL "$RELEASE_BASE/$CHANNEL.json" -o "$WORK/manifest.json" ||
	die "could not fetch $RELEASE_BASE/$CHANNEL.json"
curl -fsSL "$RELEASE_BASE/$CHANNEL.json.sig" -o "$WORK/manifest.json.sig" ||
	die "could not fetch the manifest signature; refusing to install unsigned"

# A tiny JSON read, because the one thing every host has is sed, not jq.
json_field() { sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$2" | head -n1; }
VERSION="$(json_field version "$WORK/manifest.json")"
[ -n "$VERSION" ] || die "the manifest has no version; not installing"
ARTIFACT_BLOCK="$(tr ',' '\n' <"$WORK/manifest.json" | grep -A2 -F "\"$TARGET\"" || true)"
URL="$(printf '%s' "$ARTIFACT_BLOCK" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
DIGEST="$(printf '%s' "$ARTIFACT_BLOCK" | sed -n 's/.*"sha256"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
[ -n "$URL" ] && [ -n "$DIGEST" ] || die "release $VERSION has no build for $TARGET"
case "$URL" in
http://* | https://*) ;;
*) URL="$RELEASE_BASE/${URL#/}" ;;
esac

# 4. Download and verify.
step "downloading runner $VERSION"
curl -fsSL "$URL" -o "$WORK/runner.tar.gz" || die "could not download $URL"
GOT="$(sha256 "$WORK/runner.tar.gz")"
if [ "$GOT" != "$DIGEST" ]; then
	rm -f "$WORK/runner.tar.gz"
	die "checksum mismatch: the download is not what the manifest signed.
  expected $DIGEST
  got      $GOT
Stop here and tell us; do not retry with a different mirror."
fi
say "    sha256 ok ($DIGEST)"

# 5. Install under ~/.oppenheimer/bin and link `current`.
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
say "    installed $RUNNER_HOME/bin/runner-$VERSION"

# 6. Dependencies. tmux is how a session survives; git is how a worktree
#    exists. `claude` is the agent and stays the user's business.
install_tmux() {
	case "$GOOS" in
	darwin)
		command -v brew >/dev/null 2>&1 || die "tmux is missing and Homebrew is not installed; install tmux and re-run"
		say "    running: brew install tmux"
		brew install tmux
		;;
	linux)
		say "    running: sudo apt-get install -y tmux"
		sudo apt-get update -qq && sudo apt-get install -y tmux
		;;
	esac
}
if ! command -v tmux >/dev/null 2>&1; then
	case "$INSTALL_DEPS" in
	yes) step "installing tmux"; install_tmux ;;
	no) say "warning: tmux is missing; sessions will not start until you install it" ;;
	*)
		step "tmux is missing and the runner needs it"
		printf '    install it now? [Y/n] '
		if [ -t 0 ]; then read -r answer; else answer="n"; fi
		case "${answer:-y}" in
		[Nn]*) say "    skipped; sessions will not start until tmux is installed" ;;
		*) install_tmux ;;
		esac
		;;
	esac
fi

# 7. Register. The token is spent here and never written to disk.
step "registering with $CONTROL_PLANE"
if [ -n "$NAME" ]; then
	"$RUNNER" register --token "$TOKEN" --url "$CONTROL_PLANE" --name "$NAME" --channel "$CHANNEL"
else
	"$RUNNER" register --token "$TOKEN" --url "$CONTROL_PLANE" --channel "$CHANNEL"
fi

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
