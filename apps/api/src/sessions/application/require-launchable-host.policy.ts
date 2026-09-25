import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import { runnerCanStart } from '../domain/session-state.policy';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * The host a session may be put on, for the agent it names, or the reason not.
 *
 * Two refusals, in this order. A host the caller cannot use is the hosts
 * module's not-found, raised before anything else is read. A host whose runner
 * was built before the agent — no entry for its command in the last inventory —
 * is a conflict: that runner would refuse `session.create` as an unknown agent,
 * so the session is refused here instead of being recorded and then failed by
 * the host. Whether the agent is installed is never asked.
 */
export async function requireLaunchableHost(
  hosts: HostAccessPort,
  scope: AccessScope,
  hostId: string,
  agent: string,
): Promise<void> {
  const host = await hosts.assertUsable(scope, hostId);
  if (!runnerCanStart(agent, host.probedTools)) {
    throw new AppError(SessionErrors.AGENT_UNSUPPORTED_BY_RUNNER, {
      detail: `The runner on host ${hostId} does not know the agent ${agent}; update it to start one`,
    });
  }
}
