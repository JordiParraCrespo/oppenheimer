import { CODING_AGENT_IDS, type CodingAgentId } from '@oppenheimer/shared/agents';

/**
 * The agents the reader took out of the engine picker, kept on this device
 * the way the picker's starred models are (`model-favourites.ts`). What is
 * kept is what is hidden, not what is shown, so an agent the catalog gains
 * later shows until somebody hides it. The reader's, not the workspace's: the
 * API never hears of it, and a session or automation already on a hidden
 * agent keeps it.
 */
export const HIDDEN_AGENTS_KEY = 'oppenheimer.engine.hidden';

/** `hidden` with `agent` shown again, or hidden; one entry however often it is hidden. */
export function withAgentShown(
  hidden: readonly string[],
  agent: CodingAgentId,
  shown: boolean,
): string[] {
  const rest = hidden.filter((id) => id !== agent);
  return shown ? rest : [...rest, agent];
}

/** The catalog's agents still shown, in catalog order. */
export function shownAgents(hidden: readonly string[]): CodingAgentId[] {
  return CODING_AGENT_IDS.filter((id) => !hidden.includes(id));
}

/**
 * Whether the picker draws `agent`: shown, or the one the draft is on, so a
 * draft whose agent was hidden after it was picked (a remembered last pick,
 * a project's default) still names it. With every agent hidden, which the
 * settings screen does not allow but a hand-edited storage might, the
 * picker draws them all rather than none.
 */
export function isAgentDrawn(hidden: readonly string[], agent: string, current: string): boolean {
  return agent === current || !hidden.includes(agent) || shownAgents(hidden).length === 0;
}
