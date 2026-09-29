import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { CreateSessionDto } from '@oppenheimer/shared';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import type { ParkedImagePort } from '../../links/application/parked-image.port';
import { LINK_REGISTRY, PARKED_IMAGES } from '../../links/links.di-tokens';
import type { SessionLaunchImage } from '../domain/session-launch-image.types';
import { SessionErrors } from '../domain/sessions.errors';
import { requireImageCapableHost } from './require-image-capable-host.policy';

/**
 * Turns a create's `attachmentIds` into the images its host will pull, or
 * refuses the create.
 *
 * It runs after the session's id is minted and **before** its row is written:
 * a task that talks about a screenshot must not start without it. The host is
 * asked first (`requireImageCapableHost`), then each upload is parked for this
 * session on this host. What comes back is recorded on the log's
 * `prompt.first`, so the ids outlive the request: a create that reaches its
 * host late, or again after a reconnect, still names images that are waiting.
 * The uploads themselves stay staged until they expire, so a create that fails
 * after this can be sent again as it was.
 */
@Injectable()
export class SessionAttachmentsResolver {
  constructor(
    @Inject(PARKED_IMAGES)
    private readonly images: ParkedImagePort,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
  ) {}

  async claim(
    scope: AccessScope,
    userId: string,
    sessionId: string,
    { hostId, attachmentIds: ids }: Pick<CreateSessionDto, 'hostId' | 'attachmentIds'>,
  ): Promise<SessionLaunchImage[]> {
    if (!ids?.length || !scope.organizationId) return [];
    requireImageCapableHost(this.links, hostId);
    const owner = { organizationId: scope.organizationId, userId };
    const claimed = await this.images.claim(ids, owner, { hostId, sessionId });
    if (!claimed) {
      throw new AppError(SessionErrors.ATTACHMENT_NOT_FOUND, {
        detail: 'An attached image expired or was never uploaded here; attach it again.',
      });
    }
    return claimed;
  }
}
