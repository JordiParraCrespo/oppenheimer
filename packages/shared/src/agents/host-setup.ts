/**
 * How the runner installs each agent CLI on a host, and keeps it current: the
 * half of the agent catalog only the runner uses. The generator
 * (`scripts/emit-agent-catalog.cjs`) writes it into the runner's
 * `host_tools.gen.go` and `agent_update.gen.go`.
 *
 * Apart from `catalog.ts` because the console loads the catalog on its first
 * page and never installs anything: these scripts are a third of the
 * catalog's bytes. Keyed by the catalog's ids, and checked against them by
 * the type: an agent missing here is one the runner neither installs nor
 * updates (the blank terminal).
 */

import type { CodingAgentId, HostInstall, InstallMethod } from './catalog.js';
import { bunUserInstall, npmUserInstall } from './install-scripts.js';
import { RELEASE_TEMP_DIR, type ReleasePlatform, sha256Verifier } from './release-install.js';

export interface AgentHostSetup {
  /**
   * The argv, appended to `command`, that updates this CLI in place to its
   * latest release **without asking**: the runner runs it unattended, with no
   * terminal and nothing on stdin (`product/versions/mvp/02-runner.md` §10).
   *
   * `<method>` in the argv is the install method `updateMethods` tells from
   * the executable's path; when none matches, the runner leaves the CLI
   * alone rather than run an updater that would stop to ask.
   *
   * Absent: this CLI has no updater that runs without asking (a plain
   * shell's none), and the runner leaves it alone.
   */
  readonly update?: readonly string[];
  /** What `<method>` in `update` is, by where the executable lives. */
  readonly updateMethods?: readonly InstallMethod[];
  /**
   * How the runner installs this CLI when the person asks it to
   * (`runner agents install`). Absent: it never does (a plain shell).
   */
  readonly install?: HostInstall;
}

/**
 * Claude Code's latest native build, as `claude.ai/install.sh` finds it but
 * without running that script: the version `latest` names, that version's
 * `manifest.json`, the binary for this platform checked against the
 * manifest's SHA-256, and then the verified binary's own `claude install
 * <version>`, which puts it under `~/.local/share/claude/versions` with the
 * `~/.local/bin/claude` link. Linux tells musl from glibc and macOS an x64
 * shell under Rosetta from an Intel Mac, as the vendor's script does.
 */
function claudeRelease(platform: ReleasePlatform): string {
  const target =
    platform === 'macos'
      ? [
          'if [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" = 1 ]; then arch=arm64; fi',
          'platform="darwin-$arch"',
        ]
      : [
          'if [ -f /lib/libc.musl-x86_64.so.1 ] || [ -f /lib/libc.musl-aarch64.so.1 ] || ldd /bin/ls 2>&1 | grep -q musl; then platform="linux-$arch-musl"; else platform="linux-$arch"; fi',
        ];
  return [
    'set -eu',
    'case "$(uname -m)" in x86_64|amd64) arch=x64 ;; aarch64|arm64) arch=arm64 ;; *) echo "claude: unsupported architecture $(uname -m)" >&2; exit 1 ;; esac',
    ...target,
    'base=https://downloads.claude.ai/claude-code-releases',
    ...RELEASE_TEMP_DIR,
    ...sha256Verifier(platform, 'claude'),
    'version="$(curl -fsSL "$base/latest")"',
    String.raw`printf '%s' "$version" | grep -Eqx '[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?' || { echo "claude: could not read the latest version from $base/latest" >&2; exit 1; }`,
    'curl -fsSL "$base/$version/manifest.json" -o "$tmp/manifest.json"',
    // The platform's own object only: `[^{}]*` cannot leave it.
    String.raw`checksum="$(tr -d ' \t\r\n' <"$tmp/manifest.json" | grep -o "\"$platform\":{[^{}]*}" | grep -o '"checksum":"[0-9a-f]*"' | cut -d '"' -f 4)"`,
    // Before the binary's download, which is hundreds of megabytes.
    'printf \'%s\' "$checksum" | grep -Eqx \'[0-9a-f]{64}\' || { echo "claude: the $version manifest has no checksum for $platform" >&2; exit 1; }',
    'curl -fsSL "$base/$version/$platform/claude" -o "$tmp/claude"',
    'verify "$tmp/claude" "$checksum"',
    'chmod 0755 "$tmp/claude"',
    '"$tmp/claude" install "$version" </dev/null',
  ].join('\n');
}

export const AGENT_HOST_SETUP: Readonly<Partial<Record<CodingAgentId, AgentHostSetup>>> =
  Object.freeze({
    'claude-code': Object.freeze({
      // `claude update|upgrade`: "Check for updates and install if available",
      // claude 2.1.284. It takes no options and asks nothing.
      update: Object.freeze(['update']),
      // The native build, the one Anthropic documents first: one binary in
      // `~/.local/bin`, no Node, and it keeps itself current through `update`.
      // Its latest release, checked against the release manifest's checksum,
      // rather than `claude.ai/install.sh`, which would run unchecked.
      install: Object.freeze({
        macos: claudeRelease('macos'),
        linux: claudeRelease('linux'),
        bin: '~/.local/bin',
      }),
    }),
    codex: Object.freeze({
      // `codex update`: "Update Codex to the latest version", codex-cli 0.158.0.
      // Its options are config overrides only; it asks nothing.
      update: Object.freeze(['update']),
      // `@openai/codex` from npm, which is what OpenAI's README installs first
      // and the one way that is the same on macOS and Linux. Under a `~/.local`
      // prefix so it needs no root, and `codex update` finds it there.
      install: Object.freeze({
        macos: npmUserInstall('@openai/codex'),
        linux: npmUserInstall('@openai/codex'),
        bin: '~/.local/bin',
      }),
    }),
    opencode: Object.freeze({
      // `opencode upgrade` (1.18.33) asks "Install anyways?" whenever it cannot
      // tell how it was installed, and has no flag that means "do not ask". It
      // does take the method (`--method curl|npm|pnpm|bun|brew`), and told it,
      // it detects nothing and asks nothing. So the runner tells it, from where
      // the executable really lives; an OpenCode none of these match is one
      // whose replacement is not ours to do, and it is left alone, as
      // OpenCode's own launch-time autoupdate leaves it. `curl` is not one of
      // them: that method runs `opencode.ai/install`, which checks nothing, so
      // an OpenCode in `~/.opencode/bin` keeps its own autoupdate and no more.
      // The runner's install below resolves to
      // `~/.local/lib/node_modules/opencode-ai/`, the `npm` row, whose
      // `npm install -g` the runner points at that `~/.local` prefix.
      update: Object.freeze(['upgrade', '--method', '<method>']),
      updateMethods: Object.freeze([
        Object.freeze({ method: 'brew', pathContains: '/Cellar/' }),
        Object.freeze({ method: 'bun', pathContains: '/.bun/' }),
        Object.freeze({ method: 'pnpm', pathContains: '/pnpm/' }),
        Object.freeze({ method: 'npm', pathContains: '/node_modules/' }),
      ]),
      // `opencode-ai` from npm rather than `opencode.ai/install`: the script
      // checks nothing, and the GitHub releases publish no checksum for the CLI
      // archives, while npm checks the package and the platform binary it
      // pulls in (`opencode-<platform>`) against the registry's integrity hash,
      // as it does Codex's and Grok's.
      install: Object.freeze({
        macos: npmUserInstall('opencode-ai'),
        linux: npmUserInstall('opencode-ai'),
        bin: '~/.local/bin',
      }),
    }),
    grok: Object.freeze({
      // `grok update`: "Check for updates or install a specific version", grok
      // 1.0.44. Bare, it installs the latest and asks nothing.
      update: Object.freeze(['update']),
      // `@xai-official/grok` from npm rather than `x.ai/cli/install.sh`: the
      // package lands in a directory this catalog can name, and the script's
      // destination is not documented anywhere this repo can hold it to.
      install: Object.freeze({
        macos: npmUserInstall('@xai-official/grok'),
        linux: npmUserInstall('@xai-official/grok'),
        bin: '~/.local/bin',
      }),
    }),
    pi: Object.freeze({
      // `pi update --self`: "Update pi only", through the package manager that
      // installed it, asking nothing. Bare `pi update` would also update every
      // extension the person installed, which is theirs to do.
      update: Object.freeze(['update', '--self']),
      // The npm package pi's README installs first.
      install: Object.freeze({
        macos: npmUserInstall('@mariozechner/pi-coding-agent'),
        linux: npmUserInstall('@mariozechner/pi-coding-agent'),
        bin: '~/.local/bin',
      }),
    }),
    omp: Object.freeze({
      // `omp update`: "Check for updates and install", through whichever
      // installer owns the running executable, asking nothing.
      update: Object.freeze(['update']),
      // From npm with Bun: `omp` is a Bun script and its package declares
      // `engines.bun >= 1.4.4`, and `bun install -g` is the install its README
      // recommends. Not `omp.sh/install`, which runs unchecked when Bun is
      // present.
      install: Object.freeze({
        macos: bunUserInstall('@oh-my-pi/pi-coding-agent'),
        linux: bunUserInstall('@oh-my-pi/pi-coding-agent'),
        bin: '~/.bun/bin',
      }),
    }),
  });
