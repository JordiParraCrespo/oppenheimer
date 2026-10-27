import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import type { SessionPlace } from '@oppenheimer/shared';
import { CODING_AGENTS, isCodingAgentId } from '@oppenheimer/shared/agents';
import type { RunnerCapability } from '@oppenheimer/shared/protocol';
import { SessionErrors } from './sessions.errors';

/** What is about to be sent: the agent to start and where it runs. */
export interface RunnerLaunch {
  agent: string;
  place: SessionPlace;
}

/**
 * What is known of the host's runner. `probedTools` is the tool names its last
 * inventory probed, null before it has reported one. `capabilities` is what
 * its live link's `hello` named, null when the host holds no link: an offline
 * host is not asked, since its next hello is sent the session and the dispatch
 * checks again then.
 */
export interface RunnerKnowledge {
  probedTools: readonly string[] | null;
  capabilities: readonly RunnerCapability[] | null;
}

/**
 * Whether a host's runner can start `agent`, from the tool names its last inventory
 * probed.
 *
 * A runner probes every agent command it can launch, installed or not, so a missing
 * entry means a runner older than the agent, which would refuse `session.create`.
 * Before the first inventory (`null`), and for the blank terminal (no command), it is
 * allowed. Installation is not asked: that stays a hint, and the terminal says so.
 */
export function runnerCanStart(agent: string, probedTools: readonly string[] | null): boolean {
  if (probedTools === null || !isCodingAgentId(agent)) return true;
  const { command } = CODING_AGENTS[agent];
  return command === '' || probedTools.includes(command);
}

/**
 * Whether a runner whose hello named `capabilities` takes a session in `place`:
 * a worktree session always, a folder session only when it named
 * `session.folder` (it would refuse a create with no checkouts otherwise), a
 * cloud session only when it named `session.cloud` (it would open a terminal).
 */
export function runnerTakesPlace(
  place: SessionPlace,
  capabilities: readonly RunnerCapability[],
): boolean {
  if (place === 'folder') return capabilities.includes('session.folder');
  if (place === 'cloud') return capabilities.includes('session.cloud');
  return true;
}

/**
 * The one answer to "can this host's runner take what we are about to send":
 * the catalog error that refuses it, or null.
 *
 * An agent the runner was built without is `AGENT_UNSUPPORTED_BY_RUNNER`, read
 * from the stored inventory, so it holds for an offline host too. A folder
 * session on a runner whose live link did not name `session.folder` is
 * `FOLDER_UNSUPPORTED_BY_RUNNER`; with no live link (`capabilities` null) it is
 * not refused here, and the dispatch answers `not_supported` by the same rule
 * (`runnerTakesPlace`) when the runner says hello. Whether the agent is
 * installed is never asked.
 */
export function runnerRefusal(
  launch: RunnerLaunch,
  runner: RunnerKnowledge,
): ErrorDefinition | null {
  if (!runnerCanStart(launch.agent, runner.probedTools)) {
    return SessionErrors.AGENT_UNSUPPORTED_BY_RUNNER;
  }
  if (runner.capabilities !== null && !runnerTakesPlace(launch.place, runner.capabilities)) {
    return launch.place === 'cloud'
      ? SessionErrors.CLOUD_UNSUPPORTED_BY_RUNNER
      : SessionErrors.FOLDER_UNSUPPORTED_BY_RUNNER;
  }
  return null;
}
