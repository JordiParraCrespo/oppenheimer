import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { StorageService } from '@oppenheimer/backend-storage';
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, type AvatarMimeType } from '@oppenheimer/shared';
import { ProfileErrors } from '../domain/profile.errors';
import type { AvatarStoragePort } from './avatar-storage.port';

/** File extension to store each accepted image type under. */
const EXTENSIONS: Record<AvatarMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Owns everything about where an avatar lives: what is accepted, the key it is
 * stored under, and how a stored value becomes a URL a browser can load.
 *
 * What `store()` returns is the storage key, and that is what lands in
 * `user.image`, never a URL (`StorageService` says why).
 */
@Injectable()
export class AvatarStorageAdapter implements AvatarStoragePort {
  constructor(private readonly storage: StorageService) {}

  /**
   * Size is checked here as well as by multer's own limit: multer truncates at
   * its ceiling and reports it through a different error shape, and a caller
   * that streams straight to this service (a test, a future queue consumer)
   * would otherwise bypass the check entirely.
   */
  async store(userId: string, file: Buffer, mimeType: string, size: number): Promise<string> {
    if (!isAcceptedMimeType(mimeType)) {
      throw new AppError(ProfileErrors.UNSUPPORTED_IMAGE_TYPE, {
        detail: `${mimeType} is not an accepted avatar type. Use one of: ${AVATAR_MIME_TYPES.join(', ')}.`,
        extensions: { acceptedMimeTypes: [...AVATAR_MIME_TYPES] },
      });
    }

    if (size > AVATAR_MAX_BYTES) {
      throw new AppError(ProfileErrors.FILE_TOO_LARGE, {
        detail: `That image is ${size} bytes; the limit is ${AVATAR_MAX_BYTES}.`,
        extensions: { maxBytes: AVATAR_MAX_BYTES },
      });
    }

    // A fresh key per upload, never a deterministic one. Writing over the live
    // object would change the user's visible avatar *before* the profile write
    // that points at it — so a failed save would leave them with a picture they
    // did not keep and no way back. It also means the URL changes on every
    // upload, which is what stops a browser serving the previous image from
    // cache.
    const key = `avatars/${userId}/${randomUUID()}.${EXTENSIONS[mimeType]}`;
    return this.storage.upload(file, key, mimeType);
  }

  async remove(key: string | null): Promise<void> {
    if (!key || isAbsoluteUrl(key)) return;
    await this.storage.delete(key).catch(() => {});
  }

  /**
   * A value that is already an absolute URL came from a social provider at
   * sign-up and is passed straight through — only keys we wrote are resolved
   * against storage.
   */
  async resolveUrl(stored: string | null): Promise<string | null> {
    if (!stored) return null;
    if (isAbsoluteUrl(stored)) return stored;
    return this.storage.getUrl(stored);
  }
}

function isAcceptedMimeType(mimeType: string): mimeType is AvatarMimeType {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(mimeType);
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}
