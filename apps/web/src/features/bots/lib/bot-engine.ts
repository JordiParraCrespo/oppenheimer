import type { AgentOption, EffortStop } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import {
  BOT_PROVIDER_CATALOG,
  BOT_PROVIDER_PREFERENCE,
  BOT_PROVIDERS,
  type BotProvider,
  botModelOf,
} from '@oppenheimer/shared/schemas/bot';

/**
 * The mark each provider is drawn with: the coding agent whose maker it is, so
 * Anthropic carries Claude Code's mark and OpenAI Codex's; GLM has no agent of
 * its own and falls back to the bot glyph, and so does ChatGPT, which needs a
 * mark of its own to stay a group apart from OpenAI's in the model button.
 */
const BOT_PROVIDER_MARKS: Readonly<Record<BotProvider, string>> = {
  anthropic: 'claude-code',
  glm: 'glm',
  openai: 'codex',
  chatgpt: 'chatgpt',
};

/** The table read the other way: a mark back to its provider. */
const PROVIDER_OF_MARK: ReadonlyMap<string, BotProvider> = new Map(
  BOT_PROVIDERS.map((provider) => [BOT_PROVIDER_MARKS[provider], provider]),
);

/**
 * The model button's groups: one per provider the workspace has a key or a
 * sign-in for, with that provider's models, in catalog order. A provider
 * with no key is never offered beside one that has; only when none has a
 * key is the bot's own provider there, so the button still names its model
 * and the composer says where to add the missing key.
 */
export function botProviderOptions(
  configured: readonly BotProvider[],
  current: BotProvider,
): AgentOption[] {
  const offered = BOT_PROVIDERS.filter((provider) =>
    configured.length > 0 ? configured.includes(provider) : provider === current,
  );
  return offered.map((provider) => {
    const definition = BOT_PROVIDER_CATALOG[provider];
    return {
      id: BOT_PROVIDER_MARKS[provider],
      label: definition.label,
      models: definition.models.map((model) => ({ value: model.id, label: model.label })),
    };
  });
}

/**
 * Where a bot whose provider has no key moves: the first provider, in
 * `BOT_PROVIDER_PREFERENCE` (ChatGPT before GLM), that has one. Undefined when its own has a key, or when
 * none does and there is nowhere to go.
 */
export function keyedProviderFor(
  configured: readonly BotProvider[],
  current: BotProvider,
): BotProvider | undefined {
  if (configured.includes(current)) return undefined;
  return BOT_PROVIDER_PREFERENCE.find((provider) => configured.includes(provider));
}

/** The provider a pick in the model button belongs to; undefined for a mark no provider is drawn with. */
export function providerOfMark(mark: string): BotProvider | undefined {
  return PROVIDER_OF_MARK.get(mark);
}

/** What the model button shows for a bot: its provider's group and model. */
export function botEngineValue(
  provider: BotProvider,
  model: string | null,
): { agent: string; model: string | null } {
  return { agent: BOT_PROVIDER_MARKS[provider], model: botModel(provider, model) };
}

/** The model the button names: the bot's, or its provider's default when it has none. */
export function botModel(provider: BotProvider, model: string | null): string | null {
  return botModelOf(provider, model)?.id ?? null;
}

/**
 * What the effort slider draws for a bot's model: its levels and the bot's
 * level when the model offers it, the model's default otherwise. `null` when
 * the model takes no effort, and the slider is not drawn.
 */
export function botEffort(
  provider: BotProvider,
  model: string | null,
  /** Null runs the model at its own default. */
  effort: SessionEffort | null,
): { levels: readonly SessionEffort[]; value: SessionEffort } | null {
  const offered = botModelOf(provider, model)?.effort;
  if (!offered) return null;
  return {
    levels: offered.levels,
    value: effort !== null && offered.levels.includes(effort) ? effort : offered.default,
  };
}

export function effortStops(
  levels: readonly SessionEffort[],
  labels: Record<SessionEffort, string>,
): EffortStop<SessionEffort>[] {
  return levels.map((level) => ({ value: level, label: labels[level] }));
}
