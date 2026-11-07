import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import type { SessionPlace } from '@oppenheimer/shared';
import { CODING_AGENTS, isCodingAgentId, isHostCloudAgent } from '@oppenheimer/shared/agents';
import { HOST_CLOUD_CAPABILITIES, type RunnerCapability } from '@oppenheimer/shared/protocol';
import { SessionErrors } from './sessions.errors';

/**
 * What is about to be sent: the agent to start, where it runs, and the cloud
 * session it continues (`launch.teleport`), if any.
 */
export interface RunnerLaunch {
  agent: string;
  place: SessionPlace;
  launch?: { teleport: string | null };
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
 * One thing a launch demands of the runner: a capability its hello must have
 * named, with the refusal when it did not. A null capability is a launch no
 * runner takes at all (a cloud of an agent no host starts, Cursor's).
 */
interface RunnerNeed {
  capability: RunnerCapability | null;
  refusal: ErrorDefinition;
}

/**
 * Everything a launch demands of the runner, from its shape. Its place: nothing
 * for a worktree; `session.folder` for a folder (it would refuse a create with
 * no checkouts otherwise); for a cloud, the capability of the cloud's agent,
 * `HOST_CLOUD_CAPABILITIES` (it would open a terminal, or refuse the agent).
 * And a launch that continues a cloud session needs `session.teleport`: an
 * older runner drops the field and starts an empty conversation instead. A
 * new demand is one more entry here.
 */
function launchNeeds(launch: RunnerLaunch): RunnerNeed[] {
  const needs: RunnerNeed[] = [];
  if (launch.place === 'folder') {
    needs.push({
      capability: 'session.folder',
      refusal: SessionErrors.FOLDER_UNSUPPORTED_BY_RUNNER,
    });
  }
  if (launch.place === 'cloud') {
    needs.push({
      capability: isHostCloudAgent(launch.agent) ? HOST_CLOUD_CAPABILITIES[launch.agent] : null,
      refusal: SessionErrors.CLOUD_UNSUPPORTED_BY_RUNNER,
    });
  }
  if (launch.launch?.teleport) {
    needs.push({
      capability: 'session.teleport',
      refusal: SessionErrors.TELEPORT_UNSUPPORTED_BY_RUNNER,
    });
  }
  return needs;
}

/** The first of a launch's demands a runner that named `capabilities` does not meet. */
function unmetNeed(
  launch: RunnerLaunch,
  capabilities: readonly RunnerCapability[],
): RunnerNeed | undefined {
  return launchNeeds(launch).find(
    (need) => need.capability === null || !capabilities.includes(need.capability),
  );
}

/** Whether a runner whose hello named `capabilities` takes everything `launch` demands. */
export function runnerTakesPlace(
  launch: RunnerLaunch,
  capabilities: readonly RunnerCapability[],
): boolean {
  return unmetNeed(launch, capabilities) === undefined;
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
 * (`runnerTakesPlace`) when the runner says hello. Every other demand of
 * `launchNeeds` is refused the same way (`CLOUD_…`, `TELEPORT_UNSUPPORTED_BY_RUNNER`).
 * Whether the agent is installed is never asked.
 */
export function runnerRefusal(
  launch: RunnerLaunch,
  runner: RunnerKnowledge,
): ErrorDefinition | null {
  if (!runnerCanStart(launch.agent, runner.probedTools)) {
    return SessionErrors.AGENT_UNSUPPORTED_BY_RUNNER;
  }
  if (runner.capabilities === null) return null;
  return unmetNeed(launch, runner.capabilities)?.refusal ?? null;
}
