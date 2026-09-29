import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import type { SessionImageMediaType } from '@oppenheimer/shared/protocol';
import type { ParkedImage, ParkedImagePort } from '../application/parked-image.port';

const PREFIX = 'session-image:';

interface Stored {
  hostId: string;
  sessionId: string;
  mediaType: SessionImageMediaType;
  data: string;
}

/** `ParkedImagePort` in the shared cache, where attach tickets also live. */
@Injectable()
export class CacheParkedImageAdapter implements ParkedImagePort {
  constructor(
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async park(commandId: string, image: ParkedImage): Promise<void> {
    await this.cache.set<Stored>(
      PREFIX + commandId,
      {
        hostId: image.hostId,
        sessionId: image.sessionId,
        mediaType: image.mediaType,
        data: image.data.toString('base64'),
      },
      this.ttlSeconds,
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

  /**
   * Two minutes by default: long enough for a runner on a slow link to pull the
   * image, short enough that a paste nobody collected is not kept.
   */
  private get ttlSeconds(): number {
    return this.configService.getOrThrow<number>('sessions.pastedImageTtlSeconds');
  }
}
