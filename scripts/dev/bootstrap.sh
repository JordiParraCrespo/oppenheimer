#!/usr/bin/env bash
# Get a machine ready to develop Oppenheimer, or say exactly what is left.
#
#   scripts/dev/bootstrap.sh            install what needs no root, check the rest
#   scripts/dev/bootstrap.sh --check    change nothing, report only
#   scripts/dev/bootstrap.sh --sudo     also run the steps that need root
#                                       (Docker, the docker group, browser deps)
#   scripts/dev/bootstrap.sh --no-browsers   skip Playwright's chromium and ffmpeg
#
# Idempotent: every step checks first and does nothing when the machine is
# already right, so it is safe to run again after a pull or a re-login.
#
# What it covers, on macOS, Debian and Ubuntu:
#   - Node 22, pnpm, Go, golangci-lint and gh, through mise and `mise.toml`
#     (user-level; mise itself is installed into ~/.local/bin when missing).
#     A tool already on PATH at a good version is left alone.
#   - `pnpm install`.
#   - Docker with compose, and on Linux membership of the docker group.
#   - Playwright's chromium and ffmpeg, for the e2e suites.
#   - Whether gh is signed in.
#
# It never uses sudo unless asked with --sudo, and it ends with the list of
# what still needs a person: a sudo step, a re-login, `gh auth login`.
#
# The product side of this (agent CLIs and gh on a *paired host*) is the
# runner's own job: `runner agents install`, `runner tools install gh`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECK=0
SUDO=0
BROWSERS=1
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    --sudo) SUDO=1 ;;
    --no-browsers) BROWSERS=0 ;;
    -h | --help)
      sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "bootstrap: unknown option $arg (see --help)" >&2
      exit 2
      ;;
  esac
done

# The Node floor is package.json's `engines`, read rather than copied.
NODE_MIN="$(sed -n 's/.*"node": *">=\([0-9.]*\)".*/\1/p' "$ROOT/package.json" | head -n1)"
NODE_MIN="${NODE_MIN:-22}"
GO_MINOR=24 # go 1.24 or newer
GOLANGCI_MAJOR=2

OK=()
DONE=()
TODO=()
ok() { OK+=("$1"); printf '  ok    %s\n' "$1"; }
did() { DONE+=("$1"); printf '  done  %s\n' "$1"; }
todo() { TODO+=("$1"); printf '  todo  %s\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

platform() {
  case "$(uname -s)" in
    Darwin) echo macos ;;
    Linux)
      if [ -r /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        case " ${ID:-} ${ID_LIKE:-} " in
          *" ubuntu "* | *" debian "*) echo debian ;;
          *) echo linux ;;
        esac
      else
        echo linux
      fi
      ;;
    *) echo other ;;
  esac
}
PLATFORM="$(platform)"

# The first dotted number a `--version` line prints.
version_of() { "$@" 2>/dev/null | grep -Eo '[0-9]+(\.[0-9]+)+' | head -n1 || true; }
major() { echo "${1%%.*}"; }
minor() {
  local rest="${1#*.}"
  echo "${rest%%.*}"
}

# version_ge <a> <b> — whether dotted version a is at least b, field by field.
version_ge() {
  local IFS=.
  # shellcheck disable=SC2206
  local a=($1) b=($2) i
  for i in 0 1 2; do
    [ "${a[i]:-0}" -gt "${b[i]:-0}" ] && return 0
    [ "${a[i]:-0}" -lt "${b[i]:-0}" ] && return 1
  done
  return 0
}

node_ok() {
  have node || return 1
  local v
  v="$(version_of node --version)"
  [ -n "$v" ] && version_ge "$v" "$NODE_MIN"
}
go_ok() {
  have go || return 1
  local v
  v="$(version_of go version)"
  [ -n "$v" ] && [ "$(major "$v")" -ge 1 ] && [ "$(minor "$v")" -ge "$GO_MINOR" ]
}
golangci_ok() {
  have golangci-lint || return 1
  local v
  v="$(version_of golangci-lint version)"
  [ -n "$v" ] && [ "$(major "$v")" -ge "$GOLANGCI_MAJOR" ]
}
pnpm_ok() { have pnpm && [ -n "$(version_of pnpm --version)" ]; }

# Where Playwright keeps its browsers: its own variable, else its per-OS cache.
browsers_dir() {
  if [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
    echo "$PLAYWRIGHT_BROWSERS_PATH"
  elif [ "$PLATFORM" = macos ]; then
    echo "$HOME/Library/Caches/ms-playwright"
  else
    echo "${XDG_CACHE_HOME:-$HOME/.cache}/ms-playwright"
  fi
}
# Whether chromium and ffmpeg are both there, so --check passes a machine
# that already has them.
browsers_installed() {
  local dir
  dir="$(browsers_dir)"
  compgen -G "$dir/chromium-*" >/dev/null && compgen -G "$dir/ffmpeg-*" >/dev/null
}

# Fetch a vendor installer whole, then run it: a download cut short fails
# here instead of running half a script.
run_installer() {
  local url="$1"
  shift
  local tmp
  tmp="$(mktemp)"
  curl -fsSL "$url" -o "$tmp"
  sh "$tmp" "$@" </dev/null
  rm -f "$tmp"
}

echo "Oppenheimer dev bootstrap ($PLATFORM)"
[ "$CHECK" = 1 ] && echo "  (--check: nothing will be changed)"
case "$PLATFORM" in
  macos | debian) ;;
  *) todo "this is $(uname -s) ($PLATFORM); the bootstrap supports macOS, Debian and Ubuntu, so check each item below by hand" ;;
esac

echo
echo "Toolchain (mise.toml)"
missing=()
node_ok && ok "node $(version_of node --version)" || missing+=(node)
pnpm_ok && ok "pnpm $(version_of pnpm --version)" || missing+=(pnpm)
go_ok && ok "go $(version_of go version)" || missing+=(go)
golangci_ok && ok "golangci-lint $(version_of golangci-lint version)" || missing+=(golangci-lint)
have gh && ok "gh $(version_of gh --version)" || missing+=(gh)

if [ "${#missing[@]}" -gt 0 ]; then
  if [ "$CHECK" = 1 ]; then
    todo "missing or too old: ${missing[*]}; run scripts/dev/bootstrap.sh (installs them with mise)"
  else
    if ! have mise; then
      export PATH="$HOME/.local/bin:$PATH"
    fi
    if ! have mise; then
      run_installer https://mise.run
      did "mise installed into ~/.local/bin"
    fi
    (cd "$ROOT" && mise trust --quiet mise.toml && mise install "${missing[@]}")
    # This run uses them at once; a new shell needs mise activated.
    eval "$(cd "$ROOT" && mise env -s bash)"
    did "installed with mise: ${missing[*]}"
    case "${SHELL:-}" in
      */zsh) rc='~/.zshrc' shell=zsh ;;
      */fish) rc='~/.config/fish/config.fish' shell=fish ;;
      *) rc='~/.bashrc' shell=bash ;;
    esac
    if ! grep -qs "mise activate" "${rc/#\~/$HOME}"; then
      todo "activate mise in new shells: echo 'eval \"\$(mise activate $shell)\"' >> $rc, then open a new terminal"
    fi
  fi
fi

echo
echo "Dependencies"
if [ "$CHECK" = 1 ]; then
  [ -d "$ROOT/node_modules" ] && ok "node_modules present" || todo "pnpm install"
elif pnpm_ok; then
  (cd "$ROOT" && pnpm install --frozen-lockfile)
  did "pnpm install"
fi

echo
echo "Docker"
if have docker && docker compose version >/dev/null 2>&1; then
  ok "$(docker --version | head -n1), compose $(version_of docker compose version)"
else
  case "$PLATFORM" in
    macos) todo "install Docker Desktop or OrbStack (https://orbstack.dev), which bring compose" ;;
    debian)
      if [ "$SUDO" = 1 ] && [ "$CHECK" = 0 ]; then
        tmp="$(mktemp)"
        curl -fsSL https://get.docker.com -o "$tmp"
        sudo sh "$tmp"
        rm -f "$tmp"
        did "Docker Engine and the compose plugin installed (get.docker.com)"
      else
        todo "install Docker: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh (or re-run with --sudo)"
      fi
      ;;
    *) todo "install Docker Engine with the compose plugin" ;;
  esac
fi
# Root reaches the daemon without the group; a person's account is what
# needs it.
if [ "$PLATFORM" != macos ] && have docker && [ "$(id -u)" != 0 ]; then
  user="$(id -un)"
  if id -nG "$user" | tr ' ' '\n' | grep -qx docker; then
    if docker info >/dev/null 2>&1; then
      ok "$user is in the docker group and the daemon answers"
    else
      todo "$user is in the docker group but this shell is not yet: log out and back in (or run: newgrp docker)"
    fi
  elif [ "$SUDO" = 1 ] && [ "$CHECK" = 0 ]; then
    sudo usermod -aG docker "$user"
    did "added $user to the docker group"
    todo "log out and back in so the docker group applies (or run: newgrp docker)"
  else
    todo "sudo usermod -aG docker $user, then log out and back in (or re-run with --sudo)"
  fi
fi

# oppenheimer:begin e2e
echo
echo "Playwright (e2e)"
if [ "$BROWSERS" = 0 ]; then
  ok "skipped (--no-browsers)"
elif [ -n "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" ] && [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
  ok "browsers provided by the environment ($PLAYWRIGHT_BROWSERS_PATH)"
elif browsers_installed; then
  ok "Playwright chromium and ffmpeg in $(browsers_dir)"
elif [ "$CHECK" = 1 ] || [ ! -d "$ROOT/node_modules" ]; then
  todo "pnpm --filter @oppenheimer/e2e exec playwright install chromium ffmpeg"
else
  (cd "$ROOT" && pnpm --filter @oppenheimer/e2e exec playwright install chromium ffmpeg)
  did "Playwright chromium and ffmpeg"
  if [ "$PLATFORM" = debian ]; then
    if [ "$SUDO" = 1 ]; then
      (cd "$ROOT" && sudo env "PATH=$PATH" pnpm --filter @oppenheimer/e2e exec playwright install-deps chromium)
      did "chromium's system libraries"
    else
      todo "chromium's system libraries, once: sudo env \"PATH=\$PATH\" pnpm --filter @oppenheimer/e2e exec playwright install-deps chromium (or re-run with --sudo)"
    fi
  fi
fi

# oppenheimer:end e2e

echo
echo "GitHub"
if have gh; then
  if gh auth status >/dev/null 2>&1; then
    ok "gh is signed in"
  else
    todo "gh auth login"
  fi
fi
if [ ! -f "$ROOT/.env" ]; then
  if [ "$CHECK" = 1 ]; then
    todo "cp .env.example .env"
  else
    cp "$ROOT/.env.example" "$ROOT/.env"
    did ".env created from .env.example"
  fi
fi

echo
if [ "${#TODO[@]}" -eq 0 ]; then
  echo "Ready: pnpm docker:dev && pnpm dev:mvp"
  exit 0
fi
echo "Still needs you:"
for item in "${TODO[@]}"; do
  printf '  - %s\n' "$item"
done
# Non-zero only for --check, so a script can ask "is this machine ready".
[ "$CHECK" = 1 ] && exit 1
exit 0
