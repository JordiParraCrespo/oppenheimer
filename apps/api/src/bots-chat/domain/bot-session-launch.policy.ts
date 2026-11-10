import {
  CODING_AGENTS,
  type CodingAgentId,
  type CodingAgentModel,
  effortFor,
  type SessionEffort,
  type SessionPermission,
} from '@oppenheimer/shared/agents';

/**
 * How a bot's session is launched: the composer's foot row (model, effort,
 * permission), chosen in words by the person through the bot. Everything the
 * console's engine button offers is the bot's to choose too, so "start it on
 * Opus 5.5 at high effort" starts exactly that, and a choice the agent does
 * not take comes back as the sentence that lists what it does. Pure.
 */
export interface BotSessionLaunchInput {
  /** A catalog id (`claude-opus-5-5`), its name (`Opus 5.5`), or a family (`opus`). */
  model?: string;
  effort?: SessionEffort;
  permission?: SessionPermission;
}

export interface BotSessionLaunch {
  /** The catalog id the CLI is started with; absent runs the CLI's own default. */
  model?: string;
  effort?: SessionEffort;
  permission: SessionPermission;
}

/**
 * The level a bot's session runs at when the person named none. Nobody sits
 * at a bot's terminal, so `ask` would leave the agent waiting on its first
 * approval; `auto` lets it work while still checking each action.
 */
export const BOT_SESSION_PERMISSION = 'auto' as const;

/** How many models a refusal lists, so OpenCode's long catalog stays a sentence. */
const MODELS_IN_REFUSAL_MAX = 12;

/** The words of a model's name without case or punctuation: `Opus 5.5` and `opus-5.5` are one. */
function keyOf(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The catalog row a person's words name: its id or its name, in any case or
 * punctuation, or a bare family (`opus`, `sonnet`) for that line's newest
 * model, which is how Claude Code's own `--model opus` reads. Null when
 * nothing matches.
 */
export function modelNamed(agent: CodingAgentId, words: string): CodingAgentModel | null {
  const { models } = CODING_AGENTS[agent];
  const key = keyOf(words);
  if (!key) return null;
  const exact = models.find((model) => keyOf(model.id) === key || keyOf(model.label) === key);
  if (exact) return exact;
  if (/\d/.test(key)) return null;
  const current = models.filter((model) => !model.legacy);
  return (
    current.find((model) => keyOf(model.label).startsWith(key)) ??
    current.find((model) => keyOf(model.id).includes(key)) ??
    null
  );
}

/** The models an agent offers, as a refusal lists them: name and id, the current ones first. */
export function modelChoices(agent: CodingAgentId): string {
  const { models } = CODING_AGENTS[agent];
  const ordered = [...models.filter((m) => !m.legacy), ...models.filter((m) => m.legacy)];
  const listed = ordered
    .slice(0, MODELS_IN_REFUSAL_MAX)
    .map((model) => `${model.label} (${model.id})`);
  const more = ordered.length > MODELS_IN_REFUSAL_MAX ? ', …' : '';
  return `${listed.join(', ')}${more}`;
}

/**
 * The launch a bot's session starts with, or the sentence that says which
 * part the agent does not take and what it takes instead. An effort is
 * checked against the model the session runs: the one chosen, or the agent's
 * default when none is.
 */
export function planBotSessionLaunch(
  agent: CodingAgentId,
  input: BotSessionLaunchInput,
): { launch: BotSessionLaunch } | { refusal: string } {
  const definition = CODING_AGENTS[agent];
  let model: CodingAgentModel | null = null;
  if (input.model !== undefined) {
    if (definition.models.length === 0) {
      return { refusal: `${definition.label} takes no model. Leave model out.` };
    }
    model = modelNamed(agent, input.model);
    if (!model) {
      return {
        refusal: `${definition.label} has no model "${input.model}". Its models: ${modelChoices(agent)}. Ask the person which one if none is what they meant.`,
      };
    }
  }
  if (input.effort !== undefined) {
    const offered = effortFor(agent, model?.id ?? null);
    const which = model?.label ?? `${definition.label}'s default model`;
    if (!offered) {
      return { refusal: `${which} takes no effort level. Leave effort out.` };
    }
    if (!offered.levels.includes(input.effort)) {
      return {
        refusal: `${which} has no effort "${input.effort}". Its levels, faster to smarter: ${offered.levels.join(', ')}.`,
      };
    }
  }
  if (input.permission !== undefined && !definition.launch.permission) {
    return { refusal: `${definition.label} has no approvals to set. Leave permission out.` };
  }
  return {
    launch: {
      ...(model ? { model: model.id } : {}),
      ...(input.effort ? { effort: input.effort } : {}),
      permission: input.permission ?? BOT_SESSION_PERMISSION,
    },
  };
}

/** What each permission level reads as on a card. */
const PERMISSION_PHRASES: Readonly<Record<SessionPermission, string>> = {
  ask: 'asking for approval',
  auto: 'approve for me',
  full: 'full access',
};

/**
 * The launch in a card's words, "Opus 5.5, high effort, full access", naming
 * only what the person chose, so a card says what will differ from the
 * default. Empty when nothing was chosen.
 */
export function launchPhrase(agent: CodingAgentId, input: BotSessionLaunchInput): string {
  const parts: string[] = [];
  if (input.model !== undefined) {
    parts.push(modelNamed(agent, input.model)?.label ?? input.model);
  }
  if (input.effort !== undefined) parts.push(`${input.effort} effort`);
  if (input.permission !== undefined && CODING_AGENTS[agent].launch.permission) {
    parts.push(PERMISSION_PHRASES[input.permission]);
  }
  return parts.join(', ');
}
