import { AppError } from '@oppenheimer/backend-core';
import type { StorageService } from '@oppenheimer/backend-storage';
import { AVATAR_MAX_BYTES } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarStorageAdapter } from '../infrastructure/avatar-storage.adapter';

describe('AvatarStorageAdapter', () => {
  let storage: {
    upload: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getUrl: ReturnType<typeof vi.fn>;
  };
  let avatars: AvatarStorageAdapter;

  beforeEach(() => {
    storage = {
      upload: vi.fn(async (_file: Buffer, key: string) => key),
      delete: vi.fn().mockResolvedValue(undefined),
      getUrl: vi.fn().mockResolvedValue('https://cdn.example.com/signed'),
    };
    avatars = new AvatarStorageAdapter(storage as unknown as StorageService);
  });

  describe('store', () => {
    it.each([
      ['image/png', 'png'],
      ['image/jpeg', 'jpg'],
      ['image/webp', 'webp'],
    ])('stores %s under a key of its own, in the user’s prefix, named .%s', async (type, ext) => {
      // Every back-end resolves `upload` to the key; the key is what is
      // persisted, and `getUrl` turns it into a URL at read time.
      const key = await avatars.store('user-uuid', Buffer.from('x'), type, 1);

      expect(key).toMatch(new RegExp(`^avatars/user-uuid/[0-9a-f-]{36}\\.${ext}$`));
      expect(storage.upload).toHaveBeenCalledWith(expect.any(Buffer), key, type);
    });

    it('never writes over the object the profile currently points at', async () => {
      // A deterministic key would replace the live image before the profile
      // write that adopts it, so a failed save would leave the user with a
      // picture they did not keep.
      const first = await avatars.store('user-uuid', Buffer.from('a'), 'image/png', 1);
      const second = await avatars.store('user-uuid', Buffer.from('b'), 'image/png', 1);

      expect(second).not.toBe(first);
    });

    it('rejects a type that is not an accepted image', async () => {
      const error = await avatars
        .store('user-uuid', Buffer.from('x'), 'application/pdf', 1)
        .catch((e) => e as AppError);

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('PROFILE_004');
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects an image over the size ceiling', async () => {
      const error = await avatars
        .store('user-uuid', Buffer.from('x'), 'image/png', AVATAR_MAX_BYTES + 1)
        .catch((e) => e as AppError);

      expect((error as AppError).code).toBe('PROFILE_005');
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('accepts an image exactly at the ceiling', async () => {
      await expect(
        avatars.store('user-uuid', Buffer.from('x'), 'image/webp', AVATAR_MAX_BYTES),
      ).resolves.toMatch(/\.webp$/);
    });
  });

  describe('remove', () => {
    it('does nothing when there is no avatar', async () => {
      await avatars.remove(null);

      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('does not try to delete a provider-hosted image', async () => {
      // An absolute URL came from a social provider at sign-up — it is not ours
      // to delete, and passing it as a key would be a nonsense request.
      await avatars.remove('https://lh3.googleusercontent.com/a/abc');

      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('swallows a failure to delete', async () => {
      // An orphaned object costs storage; a thrown error costs the user the
      // request they made.
      storage.delete.mockRejectedValue(new Error('gone'));

      await expect(avatars.remove('avatars/user-uuid.png')).resolves.toBeUndefined();
    });
  });

  describe('resolveUrl', () => {
    it('resolves a stored key through the back-end', async () => {
      await expect(avatars.resolveUrl('avatars/user-uuid.png')).resolves.toBe(
        'https://cdn.example.com/signed',
      );
      expect(storage.getUrl).toHaveBeenCalledWith('avatars/user-uuid.png');
    });

    it('passes an absolute URL straight through', async () => {
      await expect(avatars.resolveUrl('https://lh3.googleusercontent.com/a/abc')).resolves.toBe(
        'https://lh3.googleusercontent.com/a/abc',
      );
      expect(storage.getUrl).not.toHaveBeenCalled();
    });

    it('resolves nothing to null', async () => {
      await expect(avatars.resolveUrl(null)).resolves.toBeNull();
    });
  });
});
