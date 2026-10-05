import type { AgentOption } from '@oppenheimer/design-system-web';
import { CODING_AGENT_IDS, CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';

/** The agents and their models, from the shared catalog, as the engine button's panes. */
export function toAgentOptions(): AgentOption[] {
  return CODING_AGENT_IDS.map((id) => ({
    id,
    label: CODING_AGENTS[id].label,
    models: CODING_AGENTS[id].models.map((model) => ({ value: model.id, label: model.label })),
  }));
}

/** The model an agent runs when nobody picks one: the catalog's default, else its first. */
export function defaultModelFor(agent: CodingAgentId): string | null {
  const models = CODING_AGENTS[agent].models;
  return (models.find((model) => model.default) ?? models[0])?.id ?? null;
}
