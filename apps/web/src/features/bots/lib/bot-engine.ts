import type { AgentOption, EffortStop } from '@oppenheimer/design-system-web';
import {
  CODING_AGENTS,
  type CodingAgentEffort,
  effortFor,
  type SessionEffort,
} from '@oppenheimer/shared/agents';

/** A bot runs Claude Code, so its engine is Claude Code and its models are Claude Code's. */
export const BOT_AGENT = 'claude-code';

/** The engine button's one agent and its models, from the shared catalog. */
export function botAgentOptions(): AgentOption[] {
  const agent = CODING_AGENTS[BOT_AGENT];
  return [
    {
      id: agent.id,
      label: agent.label,
      models: agent.models.map((model) => ({ value: model.id, label: model.label })),
    },
  ];
}

/** The model the button names: the bot's, or Claude Code's default when it has none. */
export function botModel(model: string | null): string | null {
  if (model) return model;
  const models = CODING_AGENTS[BOT_AGENT].models;
  return (models.find((row) => row.default) ?? models[0])?.id ?? null;
}

/**
 * What the effort slider draws for a bot's model: its levels and the bot's
 * level when the model offers it, the model's default otherwise. `null` when
 * the model takes no effort, and the slider is not drawn.
 */
export function botEffort(
  model: string | null,
  /** Null runs the model at its CLI's default. */
  effort: SessionEffort | null,
): { levels: readonly SessionEffort[]; value: SessionEffort } | null {
  const offered: CodingAgentEffort | undefined = effortFor(BOT_AGENT, model);
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

/** The model's name as the catalog spells it ("Claude Sonnet 4.6"), for the line under a reply. */
export function botModelLabel(model: string | null): string | null {
  const id = botModel(model);
  return CODING_AGENTS[BOT_AGENT].models.find((row) => row.id === id)?.label ?? null;
}
