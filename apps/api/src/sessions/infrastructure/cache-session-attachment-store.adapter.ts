import { Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import type { SessionImageMediaType } from '@oppenheimer/shared/protocol';
import type {
  SessionAttachment,
  SessionAttachmentOwner,
  SessionAttachmentStorePort,
} from './session-attachment-store.port';

const PREFIX = 'session-attachment:';

/**
 * Fifteen minutes: the files are uploaded when the task is sent, so this only
 * has to outlast a create and a retry of it. An upload nobody names is gone
 * soon after.
 */
export const SESSION_ATTACHMENT_TTL_SECONDS = 15 * 60;

interface Stored {
  organizationId: string;
  userId: string;
  mediaType: SessionImageMediaType;
  data: string;
}

/** `SessionAttachmentStorePort` in the shared cache, beside the parked images it becomes. */
@Injectable()
export class CacheSessionAttachmentStoreAdapter implements SessionAttachmentStorePort {
  constructor(private readonly cache: CacheService) {}

  async put(attachment: SessionAttachment): Promise<void> {
    await this.cache.set<Stored>(
      PREFIX + attachment.id,
      {
        organizationId: attachment.organizationId,
        userId: attachment.userId,
        mediaType: attachment.mediaType,
        data: attachment.data.toString('base64'),
      },
      SESSION_ATTACHMENT_TTL_SECONDS,
    );
  }

  async find(id: string, owner: SessionAttachmentOwner): Promise<SessionAttachment | undefined> {
    const stored = await this.cache.get<Stored>(PREFIX + id);
    if (!stored) return undefined;
    if (stored.organizationId !== owner.organizationId || stored.userId !== owner.userId) {
      return undefined;
    }
    return {
      id,
      organizationId: stored.organizationId,
      userId: stored.userId,
      mediaType: stored.mediaType,
      data: Buffer.from(stored.data, 'base64'),
    };
  }

  async remove(ids: readonly string[]): Promise<void> {
    await Promise.all(ids.map((id) => this.cache.del(PREFIX + id)));
  }
}
