/**
 * fx, Vercel Labs' coding agent (`github.com/vercel-labs/fx`): its models
 * and its catalog entry, which `CODING_AGENTS` composes, and how the runner
 * installs it, which `host-setup.ts` composes. One native binary, `fx`.
 *
 * Everything below is read off fx v0.0.17: its docs (`fx.sh/docs`) and the
 * usage strings in the released Linux binary.
 */
import type { CodingAgentDefinition, CodingAgentModel } from './catalog.js';
import { CLAUDE_LEVELS, CODEX_LEVELS, GROK_LEVELS, levels } from './effort-levels.js';
import { RELEASE_TEMP_DIR, type ReleasePlatform, sha256Verifier } from './release-install.js';
import { TYPED_INPUT } from './typed-input.js';

/**
 * fx's models are Vercel AI Gateway ids, `<vendor>/<model>`, and the catalog
 * a host sees is whatever its gateway account offers (`fx models ls`). The
 * seed is the ids fx's own docs name and nothing else: `spacexai/grok-4.7`,
 * the gateway default and so the row a session with no model runs; the
 * OpenAI and Anthropic models its docs use for examples, review and
 * compaction; and the two open-weight ones a Token Pass team starts on.
 *
 * fx takes `--effort <level>` and checks the level against the model's own
 * menu, which its docs do not print, so each row offers its vendor's levels
 * as the other agents here already spell them, starting where that vendor's
 * CLI starts. The open-weight rows offer none.
 */
const FX_MODELS: readonly CodingAgentModel[] = Object.freeze([
  Object.freeze({
    id: 'spacexai/grok-4.7',
    label: 'Grok 4.7',
    default: true as const,
    effort: levels(GROK_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'openai/gpt-6-astra',
    label: 'GPT-6 Astra',
    effort: levels(CODEX_LEVELS, 'low'),
  }),
  Object.freeze({
    id: 'openai/gpt-6-sol',
    label: 'GPT-6 Sol',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'anthropic/claude-sonnet-5',
    label: 'Sonnet 5',
    effort: levels(CLAUDE_LEVELS, 'xhigh'),
  }),
  Object.freeze({ id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' }),
  Object.freeze({ id: 'moonshotai/kimi-k3', label: 'Kimi K3' }),
]);

export const FX_AGENT: CodingAgentDefinition = Object.freeze({
  id: 'fx',
  label: 'fx',
  command: 'fx',
  input: TYPED_INPUT,
  // `fx login codex` signs in through `auth.openai.com`, and `fx login grok`
  // through `accounts.x.ai` and `auth.x.ai`, the OAuth hosts the binary
  // carries. `fx login` itself, Vercel's device authorization page on
  // `vercel.com`, is left off: a host new to this list widens the link's
  // `loginUrl` pattern, which runners already released would refuse, so it
  // waits for a `PROTOCOL_VERSION` bump and stays a URL in the terminal.
  loginTargets: Object.freeze([
    Object.freeze({ host: 'auth.openai.com' }),
    Object.freeze({ host: 'accounts.x.ai' }),
    Object.freeze({ host: 'auth.x.ai' }),
  ]),
  // "fx saves conversations in `~/.fx/sessions/`", one folder per session id
  // (`session.json` beside `events.jsonl`); the workspace only remembers
  // which one it ran last.
  transcriptLocation: Object.freeze({
    directory: '~/.fx/sessions/',
    keyedBy: 'session-id',
  }),
  // `FX_HOME` "replaces `~/.fx`", which holds the Linux sign-ins
  // (`auth.json`, `api-key`, `chatgpt-auth.json`, `grok-auth.json`) with the
  // settings and the sessions, as `PI_CODING_AGENT_DIR` holds pi's. On macOS
  // the Vercel sign-in is in the Keychain, which every `FX_HOME` shares.
  configDirEnv: 'FX_HOME',
  models: FX_MODELS,
  launch: Object.freeze({
    // Every row is an AI Gateway id, and fx hands `--model` to whichever
    // provider is active: on a host signed in with `fx login codex` or
    // `fx login grok`, a gateway id would reach Codex or Grok and fail on the
    // first message. So a chosen model pins the gateway it belongs to; a
    // session with none runs the host's own provider and its model.
    model: Object.freeze(['--provider', 'gateway', '--model', '<model>']),
    // fx names its own conversation (no flag takes an id on a create) and
    // remembers the last one per workspace: `-c, --continue` reopens it, and
    // a session's worktree is its own and never reused, so it is this
    // session's conversation and nobody else's.
    conversation: Object.freeze({ resume: Object.freeze(['--continue']) }),
    // `--permission-mode accepts ask, auto, or full-access`. `auto` is fx's
    // default: routine edits and tests run, anything else goes to a reviewer
    // model first. Every level is sent, so a mode saved in the person's
    // `settings.json` never decides a session's.
    permission: Object.freeze({
      ask: Object.freeze({
        argv: Object.freeze(['--permission-mode', 'ask']),
        env: Object.freeze({}),
      }),
      auto: Object.freeze({
        argv: Object.freeze(['--permission-mode', 'auto']),
        env: Object.freeze({}),
      }),
      full: Object.freeze({
        argv: Object.freeze(['--permission-mode', 'full-access']),
        env: Object.freeze({}),
      }),
    }),
    effort: Object.freeze({
      argv: Object.freeze(['--effort', '<effort>']),
      env: Object.freeze({}),
    }),
    // `fx "<prompt>"` starts the interactive session with the prompt as its
    // first message; `fx ask` is the one that answers and exits.
    prompt: Object.freeze(['<prompt>']),
  }),
});

/**
 * fx's latest release from GitHub, into `~/.local/bin` where its own
 * `setup.sh` puts it, but checked first: `setup.sh` downloads from
 * `releases.fx.sh` and verifies nothing, while each GitHub release asset
 * carries a `.sha256` beside it. The release is the one `releases/latest`
 * redirects to, as gh's is, so no API call and no rate limit.
 */
export function fxRelease(platform: ReleasePlatform): string {
  const os = platform === 'macos' ? 'macos' : 'linux';
  return [
    'set -eu',
    'case "$(uname -m)" in x86_64|amd64) arch=x86_64 ;; aarch64|arm64) arch=aarch64 ;; *) echo "fx: unsupported architecture $(uname -m)" >&2; exit 1 ;; esac',
    'latest="$(curl -fsSLI -o /dev/null -w \'%{url_effective}\' https://github.com/vercel-labs/fx/releases/latest)"',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell expansion, not a JS template
    'tag="${latest##*/}"',
    'case "$tag" in v[0-9]*) ;; *) echo "fx: could not read the latest release from $latest" >&2; exit 1 ;; esac',
    `name="fx-${os}-$arch.tar.gz"`,
    'base="https://github.com/vercel-labs/fx/releases/download/$tag"',
    ...RELEASE_TEMP_DIR,
    ...sha256Verifier(platform, 'fx'),
    'curl -fsSL "$base/$name" -o "$tmp/$name"',
    'curl -fsSL "$base/$name.sha256" -o "$tmp/$name.sha256"',
    'verify "$tmp/$name" "$(cut -d \' \' -f 1 "$tmp/$name.sha256")"',
    'tar -xzf "$tmp/$name" -C "$tmp" fx',
    'mkdir -p "$HOME/.local/bin"',
    'install -m 0755 "$tmp/fx" "$HOME/.local/bin/fx"',
  ].join('\n');
}
