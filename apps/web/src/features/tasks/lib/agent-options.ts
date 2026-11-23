import type { AgentOption } from '@oppenheimer/design-system-web';
import { CODING_AGENT_IDS, CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';

/**
 * Whether a session on `agent` receives the task it starts with: on its
 * command line, or as the blank terminal's note. Muse and ZCode take none,
 * so the task's work would never reach them.
 */
export function takesTask(agent: CodingAgentId): boolean {
  const { launch } = CODING_AGENTS[agent];
  return Boolean(launch.prompt || launch.taskIsNote);
}

/**
 * The agents a task can start, and their models, from the shared catalog, as
 * the engine button's panes.
 */
export function toAgentOptions(): AgentOption[] {
  return CODING_AGENT_IDS.filter(takesTask).map((id) => ({
    id,
    label: CODING_AGENTS[id].label,
    models: CODING_AGENTS[id].models.map((model) => ({
      value: model.id,
      label: model.label,
      legacy: model.legacy,
    })),
  }));
}

/** The model an agent runs when nobody picks one: the catalog's default, else its first. */
export function defaultModelFor(agent: CodingAgentId): string | null {
  const models = CODING_AGENTS[agent].models;
  return (models.find((model) => model.default) ?? models[0])?.id ?? null;
}
