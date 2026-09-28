import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { CreateSessionDto } from '@oppenheimer/shared';
import { SessionErrors } from '../domain/sessions.errors';
import type { SessionAttachmentStorePort } from '../infrastructure/session-attachment-store.port';
import { SESSION_ATTACHMENTS, SESSION_DISPATCH } from '../sessions.di-tokens';
import type { SessionAttachedImage, SessionDispatchPort } from './session-dispatch.port';

/**
 * Answers which images a create's `attachmentIds` name, or refuses the create.
 *
 * It runs before the row is written, because a first task that talks about a
 * screenshot must not start without it: a host with no link, or a runner too
 * old to take images at launch, is refused as a paste into it would be, and so
 * is an id that is not waiting for this person. Nothing is taken here; the
 * uploads are removed once the host has been handed them, so a create that
 * fails after this can be sent again.
 */
@Injectable()
export class SessionAttachmentsResolver {
  constructor(
    @Inject(SESSION_ATTACHMENTS)
    private readonly store: SessionAttachmentStorePort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async resolve(
    scope: AccessScope,
    userId: string,
    { hostId, attachmentIds: ids }: Pick<CreateSessionDto, 'hostId' | 'attachmentIds'>,
  ): Promise<SessionAttachedImage[]> {
    if (!ids?.length || !scope.organizationId) return [];

    const support = this.dispatch.createImageSupport(hostId);
    if (support === 'host_offline') {
      throw new AppError(SessionErrors.HOST_OFFLINE, {
        detail: 'Nothing was created: attached images are not kept for a host that comes back.',
      });
    }
    if (support === 'not_supported') {
      throw new AppError(SessionErrors.HOST_CANNOT_TAKE_IMAGES, {
        detail: 'Update the runner on this host to start a session with attached images.',
      });
    }

    const owner = { organizationId: scope.organizationId, userId };
    const found = await Promise.all(ids.map((id) => this.store.find(id, owner)));
    return found.map((attachment, i) => {
      if (!attachment) {
        throw new AppError(SessionErrors.ATTACHMENT_NOT_FOUND, {
          detail: `Attachment ${ids[i]} expired or was never uploaded here; attach it again.`,
        });
      }
      return { mediaType: attachment.mediaType, data: attachment.data };
    });
  }

  /** Drops the uploads a create has handed on. */
  async release(ids: readonly string[] | undefined): Promise<void> {
    if (ids?.length) await this.store.remove(ids);
  }
}
