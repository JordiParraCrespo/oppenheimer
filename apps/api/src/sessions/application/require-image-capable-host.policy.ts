import { AppError } from '@oppenheimer/backend-core';
import { runnerTakesFiles } from '@oppenheimer/shared/protocol';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * A host a first task's files can be put on now, or the reason not.
 *
 * The files wait for the host in a cache that expires, so a host with no link
 * is refused rather than recorded and left to reconnect after they are gone;
 * a runner whose `hello` did not name `session.create.images` would drop them
 * and start the task without the files it talks about; and one that takes
 * images only (no `session.files`) would refuse a PDF or text at launch. All
 * are asked before the row is written, next to the host's other preflight
 * (`requireLaunchableHost`).
 */
export function requireImageCapableHost(
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
  if (!link.capabilities.includes('session.create.images')) {
    throw new AppError(SessionErrors.HOST_CANNOT_TAKE_IMAGES, {
      detail: 'Update the runner on this host to start a session with attached files.',
    });
  }
  if (!runnerTakesFiles(link.capabilities, mediaTypes)) {
    throw new AppError(SessionErrors.HOST_CANNOT_TAKE_IMAGES, {
      detail: 'Update the runner on this host to start a session with PDFs or text files attached.',
    });
  }
}
