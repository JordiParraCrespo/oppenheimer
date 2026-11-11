import { CODING_AGENT_IDS, type CodingAgentId, isCodingAgentId } from '@oppenheimer/shared/agents';

/**
 * Which agents New session's engine picker offers on this device: the
 * defaults below, with the reader's own choices from Settings → Agents on
 * top, kept the way the picker's starred models are (`model-favourites.ts`).
 * The reader's, not the workspace's: the API never hears of it, and a session
 * or automation already on an agent that is switched off keeps it. Settings
 * never lets the last agent go, so the picker always has one to offer.
 *
 * What is stored is each choice that differs from the default, as
 * `<agent>:on` or `<agent>:off`, so an agent added to the catalog later
 * follows `OFFERED_BY_DEFAULT` until somebody switches it.
 */
export const AGENT_CHOICES_KEY = 'oppenheimer.engine.agents';

/**
 * The agents a fresh device offers: the four most people run, and the blank
 * terminal. Every other catalog agent (Pi, Oh My Pi) is there to switch on.
 */
const OFFERED_BY_DEFAULT: readonly CodingAgentId[] = [
  'claude-code',
  'codex',
  'opencode',
  'grok',
  'shell',
];

/** Whether `agent` is offered, given the reader's `choices`. */
function isAgentShown(choices: readonly string[], agent: CodingAgentId): boolean {
  if (choices.includes(`${agent}:on`)) return true;
  if (choices.includes(`${agent}:off`)) return false;
  return OFFERED_BY_DEFAULT.includes(agent);
}

/** `choices` with `agent` switched on or off; a switch back to the default is no entry. */
export function withAgentShown(
  choices: readonly string[],
  agent: CodingAgentId,
  shown: boolean,
): string[] {
  const rest = choices.filter((choice) => choice !== `${agent}:on` && choice !== `${agent}:off`);
  return shown === OFFERED_BY_DEFAULT.includes(agent)
    ? rest
    : [...rest, `${agent}:${shown ? 'on' : 'off'}`];
}

/** The catalog's agents offered, in catalog order. */
export function shownAgents(choices: readonly string[]): CodingAgentId[] {
  return CODING_AGENT_IDS.filter((id) => isAgentShown(choices, id));
}

/**
 * The options a picker draws: every catalog agent offered, anything that is
 * not a catalog agent (a vendor's cloud agent, which Settings does not list),
 * and `current` whatever it is, so a draft whose agent was switched off after
 * it was picked (a remembered last pick, a project's default) still names
 * it. Pure, for any picker that takes the reader's choices.
 */
export function withoutHidden<T extends { id: string }>(
  options: readonly T[],
  choices: readonly string[],
  current: string,
): T[] {
  return options.filter(
    (option) =>
      option.id === current || !isCodingAgentId(option.id) || isAgentShown(choices, option.id),
  );
}
