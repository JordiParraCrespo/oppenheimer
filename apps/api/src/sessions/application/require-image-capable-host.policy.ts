import { AppError } from '@oppenheimer/backend-core';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * A host a first task's images can be put on now, or the reason not.
 *
 * The images wait for the host in a cache that expires, so a host with no link
 * is refused rather than recorded and left to reconnect after they are gone;
 * and a runner whose `hello` did not name `session.create.images` would drop
 * them and start the task without the pictures it talks about. Both are asked
 * before the row is written, next to the host's other preflight
 * (`requireLaunchableHost`).
 */
export function requireImageCapableHost(links: LinkRegistryPort, hostId: string): void {
  const link = links.find(hostId);
  if (!link) {
    throw new AppError(SessionErrors.HOST_OFFLINE, {
      detail: 'Nothing was created: attached images are not kept for a host that comes back.',
    });
  }
  if (!link.capabilities.includes('session.create.images')) {
    throw new AppError(SessionErrors.HOST_CANNOT_TAKE_IMAGES, {
      detail: 'Update the runner on this host to start a session with attached images.',
    });
  }
}
