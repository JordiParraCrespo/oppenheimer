import { AppError } from '@oppenheimer/backend-core';
import { missingFileCapability } from '@oppenheimer/shared/protocol';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * A host a first task's files can be put on now, or the reason not.
 *
 * The files wait for the host in a cache that expires, so a host with no link
 * is refused rather than recorded and left to reconnect after they are gone;
 * and a runner that cannot take these types at launch would drop them or
 * refuse them, and the task would start without the files it talks about.
 * Which runner can is `missingFileCapability`, the question the relay's
 * dispatch asks too, so the preflight and the send never disagree. Asked
 * before the row is written, next to the host's other preflight
 * (`requireLaunchableHost`).
 */
export function requireFileCapableHost(
  links: LinkRegistryPort,
  hostId: string,
  mediaTypes: readonly string[],
): void {
  const link = links.find(hostId);
  if (!link) {
    throw new AppError(SessionErrors.HOST_OFFLINE, {
      detail: 'Nothing was created: attached files are not kept for a host that comes back.',
    });
  }
  const missing = missingFileCapability(link.capabilities, 'create', mediaTypes);
  if (missing) {
    throw new AppError(SessionErrors.HOST_CANNOT_TAKE_FILE, {
      detail: `Update the runner on this host to start a session with these files attached; it did not announce ${missing}.`,
    });
  }
}
