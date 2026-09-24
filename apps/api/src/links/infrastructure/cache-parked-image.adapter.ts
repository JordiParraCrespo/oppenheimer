import { Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import type { SessionImageMediaType } from '@oppenheimer/shared/protocol';
import type { ParkedImage, ParkedImagePort } from '../application/parked-image.port';

const PREFIX = 'session-image:';

/**
 * Two minutes: long enough for a runner on a slow link to pull the image,
 * short enough that a paste nobody collected is not kept.
 */
export const PARKED_IMAGE_TTL_SECONDS = 120;

interface Stored {
  hostId: string;
  sessionId: string;
  mediaType: SessionImageMediaType;
  data: string;
}

/** `ParkedImagePort` in the shared cache, where attach tickets also live. */
@Injectable()
export class CacheParkedImageAdapter implements ParkedImagePort {
  constructor(private readonly cache: CacheService) {}

  async park(commandId: string, image: ParkedImage): Promise<void> {
    await this.cache.set<Stored>(
      PREFIX + commandId,
      {
        hostId: image.hostId,
        sessionId: image.sessionId,
        mediaType: image.mediaType,
        data: image.data.toString('base64'),
      },
      PARKED_IMAGE_TTL_SECONDS,
    );
  }

  async collect(commandId: string, hostId: string): Promise<ParkedImage | undefined> {
    const key = PREFIX + commandId;
    const peeked = await this.cache.get<Stored>(key);
    if (!peeked || peeked.hostId !== hostId) return undefined;
    // Taken in one command, so two pulls of one id cannot both succeed.
    const stored = await this.cache.take<Stored>(key);
    if (!stored) return undefined;
    return {
      hostId: stored.hostId,
      sessionId: stored.sessionId,
      mediaType: stored.mediaType,
      data: Buffer.from(stored.data, 'base64'),
    };
  }
}
