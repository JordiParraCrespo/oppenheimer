import { CODING_AGENT_IDS, type CodingAgentId } from '@oppenheimer/shared/agents';

/**
 * The agents the reader took out of the engine picker, kept on this device
 * the way the picker's starred models are (`model-favourites.ts`). What is
 * kept is what is hidden, not what is shown, so an agent the catalog gains
 * later shows until somebody hides it. The reader's, not the workspace's: the
 * API never hears of it, and a session or automation already on a hidden
 * agent keeps it. Settings → Agents never lets the last agent go, so the
 * picker always has one to offer.
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
 * The options a picker draws: every one not hidden, and `current` whatever
 * it is, so a draft whose agent was hidden after it was picked (a remembered
 * last pick, a project's default) still names it. Pure, for any picker that
 * takes the reader's hidden list.
 */
export function withoutHidden<T extends { id: string }>(
  options: readonly T[],
  hidden: readonly string[],
  current: string,
): T[] {
  return options.filter((option) => option.id === current || !hidden.includes(option.id));
}
