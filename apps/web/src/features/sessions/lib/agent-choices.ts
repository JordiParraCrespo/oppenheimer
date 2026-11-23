import { CODING_AGENT_IDS, type CodingAgentId } from '@oppenheimer/shared/agents';
import { CLOUD_AGENT_IDS, type CloudAgentId } from '@oppenheimer/shared/schemas/cloud-agent';

/**
 * Which agents New session's engine picker offers on this device: the
 * defaults below, with the reader's own choices from Settings → Agents on
 * top, kept the way the picker's starred models are (`model-favourites.ts`).
 * The reader's, not the workspace's: the API never hears of it, and a session
 * or automation already on an agent that is switched off keeps it. Settings
 * never lets the last host agent go, so the picker always has one to offer.
 * A vendor's cloud agent (Cursor) is switched the same way; it is in the
 * picker only once the reader holds its key, so it never counts as that one.
 *
 * What is stored is each choice that differs from the default, as
 * `<agent>:on` or `<agent>:off`, so an agent added to the catalog later
 * follows `OFFERED_BY_DEFAULT` until somebody switches it.
 */
export const AGENT_CHOICES_KEY = 'oppenheimer.engine.agents';

/** Every agent Settings → Agents switches: the catalog's, then the vendors' cloud agents. */
export type ChoosableAgentId = CodingAgentId | CloudAgentId;

export const CHOOSABLE_AGENT_IDS: readonly ChoosableAgentId[] = [
  ...CODING_AGENT_IDS,
  ...CLOUD_AGENT_IDS,
];

function isChoosableAgentId(id: string): id is ChoosableAgentId {
  return CHOOSABLE_AGENT_IDS.some((agent) => agent === id);
}

/**
 * The agents a fresh device offers: the four most people run, the blank
 * terminal, and a cloud agent once its key is saved. Every other catalog
 * agent (Pi, Oh My Pi, Antigravity, fx, Hermes, Muse) is there to switch on.
 */
const OFFERED_BY_DEFAULT: readonly ChoosableAgentId[] = [
  'claude-code',
  'codex',
  'opencode',
  'grok',
  'shell',
  ...CLOUD_AGENT_IDS,
];

/** Whether `agent` is offered, given the reader's `choices`. */
export function isAgentShown(choices: readonly string[], agent: ChoosableAgentId): boolean {
  if (choices.includes(`${agent}:on`)) return true;
  if (choices.includes(`${agent}:off`)) return false;
  return OFFERED_BY_DEFAULT.includes(agent);
}

/** `choices` with `agent` switched on or off; a switch back to the default is no entry. */
export function withAgentShown(
  choices: readonly string[],
  agent: ChoosableAgentId,
  shown: boolean,
): string[] {
  const rest = choices.filter((choice) => choice !== `${agent}:on` && choice !== `${agent}:off`);
  return shown === OFFERED_BY_DEFAULT.includes(agent)
    ? rest
    : [...rest, `${agent}:${shown ? 'on' : 'off'}`];
}

/** The catalog's agents offered, in catalog order: the host agents, never a cloud one. */
export function shownAgents(choices: readonly string[]): CodingAgentId[] {
  return CODING_AGENT_IDS.filter((id) => isAgentShown(choices, id));
}

/**
 * The options a picker draws: every agent offered, anything Settings does not
 * list, and `current` whatever it is, so a draft whose agent was switched off
 * after it was picked (a remembered last pick, a project's default, a cloud
 * draft) still names it. Pure, for any picker that takes the reader's choices.
 */
export function withoutHidden<T extends { id: string }>(
  options: readonly T[],
  choices: readonly string[],
  current: string,
): T[] {
  return options.filter(
    (option) =>
      option.id === current || !isChoosableAgentId(option.id) || isAgentShown(choices, option.id),
  );
}
