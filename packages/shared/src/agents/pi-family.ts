/**
 * Pi and its fork Oh My Pi: their models and their catalog entries, which
 * `CODING_AGENTS` composes. Kept beside the catalog rather than in it because
 * the two share a model seed and a vocabulary nothing else in the catalog
 * uses.
 */
import type { CodingAgentDefinition, CodingAgentModel, SessionEffort } from './catalog.js';
import { levels } from './effort-levels.js';
import { bunUserInstall, npmUserInstall } from './install-scripts.js';
import { OPENCODE_MODELS } from './opencode-models.js';
import { TYPED_INPUT } from './typed-input.js';

/**
 * The thinking levels `pi --thinking` takes, less `off`: pi 0.73.1's
 * `VALID_THINKING_LEVELS` is `off, minimal, low, medium, high, xhigh`, and
 * "don't think" is left off for the reason OpenCode's OpenAI `none` is.
 */
const PI_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;

/**
 * The levels `omp --thinking` takes, less `off` and `auto`: omp 18.18.6's
 * `CLI_THINKING_LEVELS` is `off`, pi-catalog's `THINKING_EFFORTS` (pi's five
 * and `max`), then `auto`, which is omp choosing per turn and not a level.
 */
const OMP_LEVELS = [...PI_LEVELS, 'max'] as const;

/**
 * The providers pi and omp both reach under the same `provider/` names
 * OpenCode uses (`pi --model anthropic/claude-opus-5-5`), with a sign-in or
 * an API key: Anthropic, OpenAI, xAI and Google. The open-weight rows of
 * OpenCode's seed sit under providers whose names differ between the three
 * CLIs, so they stay OpenCode's.
 */
const PI_PROVIDERS = ['anthropic/', 'openai/', 'xai/', 'google/'] as const;

/**
 * Pi's and omp's `models`: OpenCode's seed for the providers above, current
 * generations only, each row's levels cut to the ones this CLI's
 * `--thinking` takes. Both CLIs apply one thinking level to whichever model
 * runs, defaulting to their `defaultThinkingLevel` setting (`medium` in pi,
 * `high` in omp), so that is where every row's slider starts.
 *
 * A seed with the limit the others have (`product/versions/mvp/05-screens.md`,
 * question 6): a row the host's pi has no provider for fails in the session's
 * own terminal. A ChatGPT subscription is pi's `openai-codex` provider rather
 * than `openai`, so a host signed in that way picks its model in pi.
 */
function piFamilyModels(
  names: readonly SessionEffort[],
  defaultLevel: SessionEffort,
): readonly CodingAgentModel[] {
  return Object.freeze(
    OPENCODE_MODELS.filter(
      (model) => !model.legacy && PI_PROVIDERS.some((provider) => model.id.startsWith(provider)),
    ).map((model) => {
      const offered = names.filter((level) => model.effort?.levels.includes(level));
      return Object.freeze({
        id: model.id,
        label: model.label,
        ...(model.default ? { default: true as const } : {}),
        ...(offered.includes(defaultLevel) ? { effort: levels(offered, defaultLevel) } : {}),
      });
    }),
  );
}

const PI_MODELS = piFamilyModels(PI_LEVELS, 'medium');

const OMP_MODELS = piFamilyModels(OMP_LEVELS, 'high');

export const PI_AGENT: CodingAgentDefinition = Object.freeze({
  id: 'pi',
  label: 'Pi',
  // Mario Zechner's pi coding agent (`@mariozechner/pi-coding-agent`),
  // whose binary is `pi`. Everything below is read off 0.73.1's README and
  // its `dist/cli/args.js`.
  command: 'pi',
  input: TYPED_INPUT,
  // `/login` signs in to a subscription: Claude Pro/Max through
  // `claude.ai/oauth/authorize`, ChatGPT through
  // `auth.openai.com/oauth/authorize` (the two OAuth hosts pi-ai carries),
  // and GitHub Copilot through GitHub's device flow.
  loginTargets: Object.freeze([
    Object.freeze({ host: 'claude.ai' }),
    Object.freeze({ host: 'auth.openai.com' }),
    Object.freeze({ host: 'github.com', path: '/login/device' }),
  ]),
  // "Sessions auto-save to `~/.pi/agent/sessions/` organized by working
  // directory", as JSONL.
  transcriptLocation: Object.freeze({
    directory: '~/.pi/agent/sessions/',
    keyedBy: 'working-directory',
  }),
  // "Override config directory (default: `~/.pi/agent`)", which holds
  // `auth.json` along with the settings and the sessions, as
  // `CLAUDE_CONFIG_DIR` holds Claude Code's.
  configDirEnv: 'PI_CODING_AGENT_DIR',
  models: PI_MODELS,
  launch: Object.freeze({
    // "Model pattern or ID (supports `provider/id` …)".
    model: Object.freeze(['--model', '<model>']),
    // `--session <id>` opens a session that exists and cannot name a new
    // one, so like Codex's and OpenCode's the id is pi's. `--continue`
    // ("Continue most recent session") is keyed by working directory, and a
    // session's worktree is its own and never reused, so it reopens this
    // session's conversation and nobody else's.
    conversation: Object.freeze({ resume: Object.freeze(['--continue']) }),
    // No `permission`. Pi has none by design ("No permission popups. Run
    // in a container, or build your own confirmation flow with
    // extensions"): every tool call runs, so the console hides the chip
    // and records no level rather than offer an "Ask" pi would ignore.
    effort: Object.freeze({
      argv: Object.freeze(['--thinking', '<effort>']),
      env: Object.freeze({}),
    }),
    // `pi [options] [messages...]`, "Interactive with initial prompt";
    // `-p` is the one that answers and exits.
    prompt: Object.freeze(['<prompt>']),
  }),
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
});

export const OMP_AGENT: CodingAgentDefinition = Object.freeze({
  id: 'omp',
  label: 'Oh My Pi',
  // can1357's fork of pi (`@oh-my-pi/pi-coding-agent`), whose binary is
  // `omp`. Everything below is read off 18.18.6's `src/commands/launch-help.ts`
  // and `src/cli/flag-tables.ts`.
  command: 'omp',
  input: TYPED_INPUT,
  // Pi's `/login`, and so pi's hosts.
  loginTargets: Object.freeze([
    Object.freeze({ host: 'claude.ai' }),
    Object.freeze({ host: 'auth.openai.com' }),
    Object.freeze({ host: 'github.com', path: '/login/device' }),
  ]),
  // `~/.omp/agent/sessions/--<path>--/`, grouped by working directory as
  // pi's are (the `--export` example in its own help).
  transcriptLocation: Object.freeze({
    directory: '~/.omp/agent/sessions/',
    keyedBy: 'working-directory',
  }),
  // No `configDirEnv`. omp scopes a login with `--profile <name>` ("an
  // isolated profile for auth, sessions, settings, and caches"), a flag and
  // not a variable, and names no variable that moves `~/.omp/agent`.
  models: OMP_MODELS,
  launch: Object.freeze({
    model: Object.freeze(['--model', '<model>']),
    // Pi's, and for pi's reason: `--resume` takes an id omp chose, and
    // `--continue` reopens the newest conversation in this worktree.
    conversation: Object.freeze({ resume: Object.freeze(['--continue']) }),
    // `--approval-mode always-ask|always-ask-cached|write|yolo`. Its tools
    // are tiered read < write < exec, and a mode approves up to its tier:
    // `always-ask` asks for anything past a read, `write` lets edits
    // through and asks before a command, as Claude Code's `acceptEdits`
    // does, and `yolo` asks nothing. omp's own default is `yolo`, which is
    // why Ask has to be sent rather than left to the CLI.
    permission: Object.freeze({
      ask: Object.freeze({
        argv: Object.freeze(['--approval-mode', 'always-ask']),
        env: Object.freeze({}),
      }),
      auto: Object.freeze({
        argv: Object.freeze(['--approval-mode', 'write']),
        env: Object.freeze({}),
      }),
      full: Object.freeze({
        argv: Object.freeze(['--approval-mode', 'yolo']),
        env: Object.freeze({}),
      }),
    }),
    effort: Object.freeze({
      argv: Object.freeze(['--thinking', '<effort>']),
      env: Object.freeze({}),
    }),
    // `omp [messages...]`, "Interactive mode with initial prompt".
    prompt: Object.freeze(['<prompt>']),
  }),
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
});
