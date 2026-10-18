/**
 * The host tools a session leans on that are not agents: what the runner
 * probes beside the agent CLIs, and how each one gets onto a host.
 *
 * Two kinds, and the difference is who installs them:
 *
 * - **`git` and `tmux`** are the host's package manager's. A session cannot
 *   exist without them, they are system packages on every platform here, and
 *   installing one needs root, which the runner never takes. A host missing
 *   one is told the exact command (`packages`), and the person runs it.
 * - **`gh`** is installed by the runner, user-level, the way an agent CLI is
 *   (`install`): `runner tools install gh`.
 *
 * Like the agent catalog this is data, generated into the runner
 * (`host_tools.gen.go`) by `scripts/emit-agent-catalog.cjs`.
 */
import type { HostInstall } from './catalog.js';
import { RELEASE_TEMP_DIR, sha256Verifier } from './release-install.js';

export const HOST_TOOL_IDS = ['git', 'tmux', 'gh'] as const;

export type HostToolId = (typeof HOST_TOOL_IDS)[number];

interface HostToolBase {
  readonly id: HostToolId;
  readonly label: string;
  /** The executable probed on PATH. */
  readonly command: string;
  /** Whether a host without it can open sessions at all. */
  readonly required: boolean;
}

/**
 * A tool the person installs with the package manager: the runner reports
 * `brew install <brew>` or `sudo apt-get install -y <apt>` and runs neither.
 */
interface PackagedHostTool extends HostToolBase {
  readonly packages: Readonly<{ brew: string; apt: string }>;
  readonly install?: never;
}

/** A tool the runner installs itself, as an agent CLI's `install` is. */
interface InstalledHostTool extends HostToolBase {
  readonly install: HostInstall;
  readonly packages?: never;
}

/** Exactly one of the two ways onto a host, so nothing chooses at runtime. */
export type HostToolDefinition = PackagedHostTool | InstalledHostTool;

/**
 * GitHub's CLI from its own release, into `~/.local/bin`: the apt
 * repository GitHub documents needs root, and the tarball is the same binary.
 * The release is the one `releases/latest` redirects to — no API call, so no
 * unauthenticated rate limit — and the archive is checked against the
 * release's own checksum file before anything is unpacked.
 */
const GH_LINUX = [
  'set -eu',
  'case "$(uname -m)" in x86_64|amd64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; armv6l|armv7l) arch=armv6 ;; *) echo "gh: unsupported architecture $(uname -m)" >&2; exit 1 ;; esac',
  'latest="$(curl -fsSLI -o /dev/null -w \'%{url_effective}\' https://github.com/cli/cli/releases/latest)"',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell expansion, not a JS template
  'version="${latest##*/v}"',
  'case "$version" in [0-9]*) ;; *) echo "gh: could not read the latest release from $latest" >&2; exit 1 ;; esac',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell expansion, not a JS template
  'name="gh_${version}_linux_${arch}"',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell expansion, not a JS template
  'base="https://github.com/cli/cli/releases/download/v${version}"',
  ...RELEASE_TEMP_DIR,
  ...sha256Verifier('linux', 'gh'),
  'curl -fsSL "$base/$name.tar.gz" -o "$tmp/$name.tar.gz"',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell expansion, not a JS template
  'curl -fsSL "$base/gh_${version}_checksums.txt" -o "$tmp/checksums.txt"',
  'verify "$tmp/$name.tar.gz" "$(awk -v f="$name.tar.gz" \'$2 == f { print $1 }\' "$tmp/checksums.txt")"',
  'tar -xzf "$tmp/$name.tar.gz" -C "$tmp"',
  'mkdir -p "$HOME/.local/bin"',
  'install -m 0755 "$tmp/$name/bin/gh" "$HOME/.local/bin/gh"',
].join('\n');

/** Homebrew installs as the person on macOS, and is how GitHub ships it there. */
const GH_MACOS = [
  'set -eu',
  'command -v brew >/dev/null 2>&1 || { echo "Homebrew is not on PATH; install it from https://brew.sh first" >&2; exit 1; }',
  'HOMEBREW_NO_AUTO_UPDATE=1 brew install gh',
].join('\n');

export const HOST_TOOLS: Readonly<Record<HostToolId, HostToolDefinition>> = Object.freeze({
  git: Object.freeze({
    id: 'git',
    label: 'Git',
    command: 'git',
    required: true,
    packages: Object.freeze({ brew: 'git', apt: 'git' }),
  }),
  tmux: Object.freeze({
    id: 'tmux',
    label: 'tmux',
    command: 'tmux',
    required: true,
    packages: Object.freeze({ brew: 'tmux', apt: 'tmux' }),
  }),
  gh: Object.freeze({
    id: 'gh',
    label: 'GitHub CLI',
    command: 'gh',
    required: false,
    install: Object.freeze({ macos: GH_MACOS, linux: GH_LINUX, bin: '~/.local/bin' }),
  }),
});
