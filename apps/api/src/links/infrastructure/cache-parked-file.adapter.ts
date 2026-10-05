import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';
import type {
  ClaimedFile,
  ParkedFile,
  ParkedFilePort,
  StagedFile,
  StagedFileOwner,
} from '../application/parked-file.port';

// The keys keep their first name: an entry written before a deploy is still
// found after it.
const PARKED = 'session-image:';
const STAGED = 'session-image:staged:';
const OWNER = 'session-image:owner:';

/**
 * Two minutes for a paste: long enough for a runner on a slow link to pull the
 * file, short enough that a paste nobody collected is not kept.
 */
export const PARKED_FILE_TTL_SECONDS = 120;

/**
 * An hour for a first task's files: they must outlast a create that waits for
 * its host to reconnect, and the log names them until then.
 */
export const CLAIMED_FILE_TTL_SECONDS = 60 * 60;

/** Ten minutes: uploads happen when the task is sent, so this only outlasts a create and its retry. */
export const STAGED_FILE_TTL_SECONDS = 10 * 60;

/**
 * How many uploads one person may have waiting. Each is up to 5 MB in the
 * Redis that also backs sign-in and rate limits, so the bound is on bytes held,
 * not on requests made: two tasks' worth of files.
 */
export const STAGED_FILES_PER_OWNER = 10;

interface Parked {
  hostId: string;
  sessionId: string;
  mediaType: SessionFileMediaType;
  data: string;
}

interface Staged extends StagedFileOwner {
  mediaType: SessionFileMediaType;
  data: string;
}

/** `ParkedFilePort` in the shared cache, where attach tickets also live. */
@Injectable()
export class CacheParkedFileAdapter implements ParkedFilePort {
  constructor(private readonly cache: CacheService) {}

  async park(commandId: string, file: ParkedFile): Promise<void> {
    await this.cache.set<Parked>(
      PARKED + commandId,
      {
        hostId: file.hostId,
        sessionId: file.sessionId,
        mediaType: file.mediaType,
        data: file.data.toString('base64'),
      },
      PARKED_FILE_TTL_SECONDS,
    );
  }

  async stage(file: StagedFile): Promise<string | undefined> {
    const id = contentId(file);
    const ownerKey = `${OWNER + file.organizationId}:${file.userId}`;
    // Only the ids still staged count: an expired one freed its place.
    const listed = (await this.cache.get<string[]>(ownerKey)) ?? [];
    const alive = await this.cache.mget<Staged>(listed.map((staged) => STAGED + staged));
    const waiting = listed.filter((_, i) => alive[i] !== undefined && listed[i] !== id);
    // Staging the same bytes again takes no new place.
    if (waiting.length >= STAGED_FILES_PER_OWNER) return undefined;
    await this.cache.set<Staged>(
      STAGED + id,
      {
        organizationId: file.organizationId,
        userId: file.userId,
        mediaType: file.mediaType,
        data: file.data.toString('base64'),
      },
      STAGED_FILE_TTL_SECONDS,
    );
    await this.cache.set(ownerKey, [...waiting, id], STAGED_FILE_TTL_SECONDS);
    return id;
  }

  async claim(
    ids: readonly string[],
    owner: StagedFileOwner,
    target: { hostId: string; sessionId: string },
  ): Promise<ClaimedFile[] | undefined> {
    const staged = await this.read(ids, owner);
    if (!staged) return undefined;
    return Promise.all(
      staged.map(async (file) => {
        // A fresh id per claim: the same screenshot in two sessions is two
        // pulls by two hosts, never one record they race for.
        const imageId = randomUUID();
        await this.cache.set<Parked>(
          PARKED + imageId,
          { ...target, mediaType: file.mediaType, data: file.data },
          CLAIMED_FILE_TTL_SECONDS,
        );
        return { imageId, mediaType: file.mediaType };
      }),
    );
  }

  async collect(imageId: string, hostId: string): Promise<ParkedFile | undefined> {
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

  /** Each id's staged file when every one is waiting for `owner`, in order. */
  private async read(
    ids: readonly string[],
    owner: StagedFileOwner,
  ): Promise<Staged[] | undefined> {
    if (ids.length === 0) return [];
    const found = await this.cache.mget<Staged>(ids.map((id) => STAGED + id));
    const mine = (file: Staged | undefined): file is Staged =>
      file?.organizationId === owner.organizationId && file?.userId === owner.userId;
    return found.every(mine) ? found : undefined;
  }
}

/**
 * The id an upload is named by: its owner and its bytes, shaped as a UUID. The
 * same file uploaded again by the same person is the same id, which is what
 * lets a create be retried with the body it was first sent with.
 */
function contentId(file: StagedFile): string {
  const hex = createHash('sha256')
    // The type too: the same text staged as notes.md and as data.json is two
    // uploads, each keeping the type its response named.
    .update(`${file.organizationId}:${file.userId}:${file.mediaType}:`)
    .update(file.data)
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
