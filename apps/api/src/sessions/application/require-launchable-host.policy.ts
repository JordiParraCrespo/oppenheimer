import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { CreateSessionDto } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { runnerRefusal } from '../domain/runner-refusal.policy';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * The host a session may be put on, for the agent and the place it names, or
 * the reason not.
 *
 * A host the caller cannot use is the hosts module's not-found, raised before
 * anything else is read. Then one question, asked of what is known of the
 * host's runner (its stored inventory and, when it holds a link, the live
 * link's capabilities): can it take what we are about to send?
 * `runnerRefusal` answers it, and is the whole rule.
 */
export async function requireLaunchableHost(
  hosts: HostAccessPort,
  links: LinkRegistryPort,
  scope: AccessScope,
  input: Pick<CreateSessionDto, 'hostId' | 'agent' | 'folder' | 'cloud'>,
): Promise<void> {
  const { hostId, agent } = input;
  const host = await hosts.assertUsable(scope, hostId);
  const refusal = runnerRefusal(
    { agent, place: input.folder ? 'folder' : input.cloud ? 'cloud' : 'worktree' },
    { probedTools: host.probedTools, capabilities: links.find(hostId)?.capabilities ?? null },
  );
  if (!refusal) return;
  const detail =
    refusal === SessionErrors.FOLDER_UNSUPPORTED_BY_RUNNER
      ? `The runner on host ${hostId} predates folder sessions; update it to start one in a folder`
      : refusal === SessionErrors.CLOUD_UNSUPPORTED_BY_RUNNER
        ? `The runner on host ${hostId} predates cloud sessions; update it to start one in the cloud`
        : `The runner on host ${hostId} does not know the agent ${agent}; update it to start one`;
  throw new AppError(refusal, { detail });
}
