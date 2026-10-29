import { CODING_AGENTS, type HostCloudAgentId } from '@oppenheimer/shared/agents';
import { HOST_CLOUD_CAPABILITIES, type RunnerCapability } from '@oppenheimer/shared/protocol';

/**
 * Whether a host can start a cloud session of `agent` now — Claude Code's
 * (`product/versions/mvp/24-session-places.md` §7) or Codex's
 * (`product/next-steps/cloud-agents.md`): it is online, its runner's live link
 * named the capability for that agent's cloud, and the agent's CLI is on it.
 * `null` is "not known here": the host is online but this process holds no
 * link for it, so the create is not refused on that account and the dispatch
 * decides.
 *
 * A host whose inventory did not find the CLI cannot, whatever its runner
 * takes; one whose runner reported no inventory yet is not ruled out on that
 * count.
 */
export function hostStartsCloud(
  host: {
    online: boolean;
    liveCapabilities: readonly RunnerCapability[] | null;
    installedTools: readonly string[] | null;
  },
  agent: HostCloudAgentId,
): boolean | null {
  if (!host.online) return false;
  const command = CODING_AGENTS[agent].command;
  if (host.installedTools !== null && !host.installedTools.includes(command)) return false;
  if (host.liveCapabilities === null) return null;
  return host.liveCapabilities.includes(HOST_CLOUD_CAPABILITIES[agent]);
}
