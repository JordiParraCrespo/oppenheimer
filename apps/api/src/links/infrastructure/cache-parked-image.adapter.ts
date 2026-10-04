import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';
import type {
  ClaimedImage,
  ParkedImage,
  ParkedImagePort,
  StagedImage,
  StagedImageOwner,
} from '../application/parked-image.port';

const PARKED = 'session-image:';
const STAGED = 'session-image:staged:';
const OWNER = 'session-image:owner:';

/**
 * Two minutes for a paste: long enough for a runner on a slow link to pull the
 * image, short enough that a paste nobody collected is not kept.
 */
export const PARKED_IMAGE_TTL_SECONDS = 120;

/**
 * An hour for a first task's images: they must outlast a create that waits for
 * its host to reconnect, and the log names them until then.
 */
export const CLAIMED_IMAGE_TTL_SECONDS = 60 * 60;

/** Ten minutes: uploads happen when the task is sent, so this only outlasts a create and its retry. */
export const STAGED_IMAGE_TTL_SECONDS = 10 * 60;

/**
 * How many uploads one person may have waiting. Each is up to 5 MB in the
 * Redis that also backs sign-in and rate limits, so the bound is on bytes held,
 * not on requests made: two tasks' worth of images.
 */
export const STAGED_IMAGES_PER_OWNER = 10;

interface Parked {
  hostId: string;
  sessionId: string;
  mediaType: SessionFileMediaType;
  data: string;
}

interface Staged extends StagedImageOwner {
  mediaType: SessionFileMediaType;
  data: string;
}

/** `ParkedImagePort` in the shared cache, where attach tickets also live. */
@Injectable()
export class CacheParkedImageAdapter implements ParkedImagePort {
  constructor(private readonly cache: CacheService) {}

  async park(commandId: string, image: ParkedImage): Promise<void> {
    await this.cache.set<Parked>(
      PARKED + commandId,
      {
        hostId: image.hostId,
        sessionId: image.sessionId,
        mediaType: image.mediaType,
        data: image.data.toString('base64'),
      },
      PARKED_IMAGE_TTL_SECONDS,
    );
  }

  async stage(image: StagedImage): Promise<string | undefined> {
    const id = contentId(image);
    const ownerKey = `${OWNER + image.organizationId}:${image.userId}`;
    // Only the ids still staged count: an expired one freed its place.
    const listed = (await this.cache.get<string[]>(ownerKey)) ?? [];
    const alive = await this.cache.mget<Staged>(listed.map((staged) => STAGED + staged));
    const waiting = listed.filter((_, i) => alive[i] !== undefined && listed[i] !== id);
    // Staging the same bytes again takes no new place.
    if (waiting.length >= STAGED_IMAGES_PER_OWNER) return undefined;
    await this.cache.set<Staged>(
      STAGED + id,
      {
        organizationId: image.organizationId,
        userId: image.userId,
        mediaType: image.mediaType,
        data: image.data.toString('base64'),
      },
      STAGED_IMAGE_TTL_SECONDS,
    );
    await this.cache.set(ownerKey, [...waiting, id], STAGED_IMAGE_TTL_SECONDS);
    return id;
  }

  async claim(
    ids: readonly string[],
    owner: StagedImageOwner,
    target: { hostId: string; sessionId: string },
  ): Promise<ClaimedImage[] | undefined> {
    const staged = await this.read(ids, owner);
    if (!staged) return undefined;
    return Promise.all(
      staged.map(async (image) => {
        // A fresh id per claim: the same screenshot in two sessions is two
        // pulls by two hosts, never one record they race for.
        const imageId = randomUUID();
        await this.cache.set<Parked>(
          PARKED + imageId,
          { ...target, mediaType: image.mediaType, data: image.data },
          CLAIMED_IMAGE_TTL_SECONDS,
        );
        return { imageId, mediaType: image.mediaType };
      }),
    );
  }

  async collect(imageId: string, hostId: string): Promise<ParkedImage | undefined> {
    const key = PARKED + imageId;
    const peeked = await this.cache.get<Parked>(key);
    if (!peeked || peeked.hostId !== hostId) return undefined;
    // Taken in one command, so two pulls of one id cannot both succeed.
    const stored = await this.cache.take<Parked>(key);
    if (!stored) return undefined;
    return {
      hostId: stored.hostId,
      sessionId: stored.sessionId,
      mediaType: stored.mediaType,
      data: Buffer.from(stored.data, 'base64'),
    };
  }

  /** Each id's staged image when every one is waiting for `owner`, in order. */
  private async read(
    ids: readonly string[],
    owner: StagedImageOwner,
  ): Promise<Staged[] | undefined> {
    if (ids.length === 0) return [];
    const found = await this.cache.mget<Staged>(ids.map((id) => STAGED + id));
    const mine = (image: Staged | undefined): image is Staged =>
      image?.organizationId === owner.organizationId && image.userId === owner.userId;
    return found.every(mine) ? found : undefined;
  }
}

/**
 * The id an upload is named by: its owner and its bytes, shaped as a UUID. The
 * same file uploaded again by the same person is the same id, which is what
 * lets a create be retried with the body it was first sent with.
 */
function contentId(image: StagedImage): string {
  const hex = createHash('sha256')
    .update(`${image.organizationId}:${image.userId}:`)
    .update(image.data)
    .digest('hex');
  // Version 8 ("custom") and the RFC 4122 variant, so it parses as a UUID.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `8${hex.slice(13, 16)}`,
    ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}
