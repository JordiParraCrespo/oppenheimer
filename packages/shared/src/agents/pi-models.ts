import type { CodingAgentModel, SessionEffort } from './catalog.js';
import { levels } from './effort-levels.js';
import { OPENCODE_MODELS } from './opencode-models.js';

/**
 * The thinking levels `pi --thinking` takes, less `off`: pi 0.73.1's
 * `VALID_THINKING_LEVELS` is `off, minimal, low, medium, high, xhigh`, and
 * "don't think" is left off for the reason OpenCode's OpenAI `none` is.
 */
export const PI_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;

/**
 * The levels `omp --thinking` takes, less `off` and `auto`: omp 18.18.6's
 * `CLI_THINKING_LEVELS` is `off`, pi-catalog's `THINKING_EFFORTS` (pi's five
 * and `max`), then `auto`, which is omp choosing per turn and not a level.
 */
export const OMP_LEVELS = [...PI_LEVELS, 'max'] as const;

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

export const PI_MODELS = piFamilyModels(PI_LEVELS, 'medium');

export const OMP_MODELS = piFamilyModels(OMP_LEVELS, 'high');
