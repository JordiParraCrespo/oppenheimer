import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { CreateSessionDto } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { runnerCanStart } from '../domain/session-state.policy';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * The host a session may be put on, for the agent and the place it names, or
 * the reason not.
 *
 * Three refusals, in this order. A host the caller cannot use is the hosts
 * module's not-found, raised before anything else is read. A host whose runner
 * was built before the agent — no entry for its command in the last inventory —
 * is a conflict: that runner would refuse `session.create` as an unknown agent,
 * so the session is refused here instead of being recorded and then failed by
 * the host. Whether the agent is installed is never asked. And a folder session
 * on a host whose live runner did not name `session.folder` is the same kind of
 * conflict; an offline host is not asked, since its next hello is sent the
 * session and the dispatch checks again then.
 */
export async function requireLaunchableHost(
  hosts: HostAccessPort,
  links: LinkRegistryPort,
  scope: AccessScope,
  input: Pick<CreateSessionDto, 'hostId' | 'agent' | 'folder'>,
): Promise<void> {
  const { hostId, agent } = input;
  const host = await hosts.assertUsable(scope, hostId);
  if (!runnerCanStart(agent, host.probedTools)) {
    throw new AppError(SessionErrors.AGENT_UNSUPPORTED_BY_RUNNER, {
      detail: `The runner on host ${hostId} does not know the agent ${agent}; update it to start one`,
    });
  }
  const link = input.folder ? links.find(hostId) : undefined;
  if (link && !link.capabilities.includes('session.folder')) {
    throw new AppError(SessionErrors.FOLDER_UNSUPPORTED_BY_RUNNER, {
      detail: `The runner on host ${hostId} predates folder sessions; update it to start one in a folder`,
    });
  }
}
