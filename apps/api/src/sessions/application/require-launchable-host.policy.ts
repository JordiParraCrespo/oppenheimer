import { AppError } from '@oppenheimer/backend-core';
import { type CreateSessionDto, placeOfCreate } from '@oppenheimer/shared';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { runnerRefusal } from '../domain/runner-refusal.policy';
import { SessionErrors } from '../domain/sessions.errors';

/** What an out-of-date runner is told to do, per place it cannot take yet. */
const REFUSAL_DETAIL: Record<string, (hostId: string) => string> = {
  [SessionErrors.FOLDER_UNSUPPORTED_BY_RUNNER.code]: (hostId) =>
    `The runner on host ${hostId} predates folder sessions; update it to start one in a folder`,
  [SessionErrors.CLOUD_UNSUPPORTED_BY_RUNNER.code]: (hostId) =>
    `The runner on host ${hostId} predates cloud sessions; update it to start one in the cloud`,
};

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
    { agent, place: placeOfCreate(input) },
    { probedTools: host.probedTools, capabilities: links.find(hostId)?.capabilities ?? null },
  );
  if (!refusal) return;
  const detail =
    REFUSAL_DETAIL[refusal.code]?.(hostId) ??
    `The runner on host ${hostId} does not know the agent ${agent}; update it to start one`;
  throw new AppError(refusal, { detail });
}
