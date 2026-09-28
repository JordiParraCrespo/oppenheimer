import { CODING_AGENTS, isCodingAgentId } from '@oppenheimer/shared/agents';

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
