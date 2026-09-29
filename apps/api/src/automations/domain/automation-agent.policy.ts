import { CODING_AGENTS, effortFor, isCodingAgentId } from '@oppenheimer/shared/agents';

/**
 * Which agents an automation may run (§Q2): one that launches a command, has
 * permission levels to set, and names models — the frames offer Claude Code,
 * Codex and OpenCode and leave the blank terminal out. The catalog's
 * `headless` block joins this test in the headless slice.
 */
export function automationAgentSupported(agent: string): boolean {
  if (!isCodingAgentId(agent)) return false;
  const definition = CODING_AGENTS[agent];
  return (
    definition.command !== '' &&
    Boolean(definition.launch.permission) &&
    definition.models.length > 0
  );
}

/**
 * The effort a revision of `agent` on `model` keeps: the level when that
 * model's CLI offers it, and null — the agent's own default — otherwise.
 *
 * Levels are the model's (`effortFor`), and a run's launch drops one its model
 * lacks, so a revision that kept it would report a level none of its runs
 * start at: Luna's missing `ultra`, or anything after a switch to Haiku. It is
 * decided on the whole next revision, because an edit can change the agent or
 * the model without touching the effort. An agent this build does not know
 * keeps the level: it cannot be checked, and it cannot run either.
 */
export function automationEffortFor(
  agent: string,
  model: string | null,
  effort: string | null,
): string | null {
  if (effort === null || !isCodingAgentId(agent)) return effort;
  return effortFor(agent, model)?.levels.some((level) => level.id === effort) ? effort : null;
}
