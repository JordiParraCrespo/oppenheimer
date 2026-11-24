import { CODING_AGENTS, isCodingAgentId } from '@oppenheimer/shared/agents';

/**
 * Which agents an automation may run: one that launches a command, has
 * permission levels to set, names models, and takes its task on the command
 * line, since nobody is there to type it — the frames offer Claude Code,
 * Codex and OpenCode and leave the blank terminal and Muse out; Qwen Code
 * passes it as well. The catalog's
 * `headless` block joins this test in the headless slice.
 */
export function automationAgentSupported(agent: string): boolean {
  if (!isCodingAgentId(agent)) return false;
  const definition = CODING_AGENTS[agent];
  return (
    definition.command !== '' &&
    Boolean(definition.launch.permission) &&
    Boolean(definition.launch.prompt) &&
    definition.models.length > 0
  );
}
