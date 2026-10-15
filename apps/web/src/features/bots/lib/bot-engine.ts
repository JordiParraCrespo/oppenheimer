import type { AgentOption, EffortStop } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import {
  BOT_PROVIDER_CATALOG,
  BOT_PROVIDERS,
  type BotProvider,
  botModelOf,
} from '@oppenheimer/shared/schemas/bot';

/**
 * The mark each provider is drawn with: the coding agent whose maker it is, so
 * Anthropic carries Claude Code's mark and OpenAI Codex's; GLM has no agent of
 * its own and falls back to the bot glyph.
 */
const BOT_PROVIDER_MARKS: Readonly<Record<BotProvider, string>> = {
  anthropic: 'claude-code',
  glm: 'glm',
  openai: 'codex',
};

/** The table read the other way: a mark back to its provider. */
const PROVIDER_OF_MARK: ReadonlyMap<string, BotProvider> = new Map(
  BOT_PROVIDERS.map((provider) => [BOT_PROVIDER_MARKS[provider], provider]),
);

/** The model button's groups: one per provider, with that provider's models. */
export function botProviderOptions(): AgentOption[] {
  return BOT_PROVIDERS.map((provider) => {
    const definition = BOT_PROVIDER_CATALOG[provider];
    return {
      id: BOT_PROVIDER_MARKS[provider],
      label: definition.label,
      models: definition.models.map((model) => ({ value: model.id, label: model.label })),
    };
  });
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
