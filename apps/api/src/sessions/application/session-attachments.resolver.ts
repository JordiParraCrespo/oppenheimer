import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { CreateSessionDto } from '@oppenheimer/shared';
import { SESSION_IMAGE_MEDIA_TYPES } from '@oppenheimer/shared/protocol';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import type { ParkedFilePort } from '../../links/application/parked-file.port';
import { LINK_REGISTRY, PARKED_FILES } from '../../links/links.di-tokens';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';
import { SessionErrors } from '../domain/sessions.errors';
import { requireFileCapableHost } from './require-file-capable-host.policy';

/**
 * Turns a create's `attachmentIds` into the files its host will pull, or refuses
 * the create.
 *
 * It runs after the session's id is minted and **before** its row is written: a task
 * that talks about a screenshot or a PDF must not start without it. The result is recorded on
 * the log's `prompt.first`, so a create that reaches its host late, or again after a
 * reconnect, still names images that are waiting. Uploads stay staged until they
 * expire, so a create that fails after this can be sent again as it was.
 */
@Injectable()
export class SessionAttachmentsResolver {
  constructor(
    @Inject(PARKED_FILES)
    private readonly files: ParkedFilePort,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
  ) {}

  async claim(
    scope: AccessScope,
    userId: string,
    sessionId: string,
    { hostId, attachmentIds: ids }: Pick<CreateSessionDto, 'hostId' | 'attachmentIds'>,
  ): Promise<SessionLaunchFile[]> {
    if (!ids?.length || !scope.organizationId) return [];
    // The types are not known until the claim; first ask what any file needs.
    requireFileCapableHost(this.links, hostId, SESSION_IMAGE_MEDIA_TYPES);
    const owner = { organizationId: scope.organizationId, userId };
    const claimed = await this.files.claim(ids, owner, { hostId, sessionId });
    if (!claimed) {
      throw new AppError(SessionErrors.ATTACHMENT_NOT_FOUND, {
        detail: 'An attached file expired or was never uploaded here; attach it again.',
      });
    }
    // The types are known once claimed. A refusal here leaves the staged
    // copies, so the same create can be sent again once the runner is updated;
    // the claimed copies expire unread.
    requireFileCapableHost(
      this.links,
      hostId,
      claimed.map((image) => image.mediaType),
    );
    return claimed;
  }
}
