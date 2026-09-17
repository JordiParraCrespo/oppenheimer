import { AppError } from '@oppenheimer/frontend-core';
import { AVATAR_MAX_BYTES } from '@oppenheimer/shared/schemas/profile';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileRepository } from '../profile.repository';
import { ProfileService } from '../profile.service';

function blob(type: string, size: number): Blob {
  // A real Blob of the right size would allocate megabytes for the ceiling
  // test; only `type` and `size` are read.
  return { type, size } as Blob;
}

describe('ProfileService', () => {
  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let service: ProfileService;

  beforeEach(() => {
    repository = {
      get: vi.fn().mockResolvedValue({ id: 'user-1' }),
      update: vi.fn().mockResolvedValue({ id: 'user-1' }),
      uploadAvatar: vi.fn().mockResolvedValue({ id: 'user-1' }),
      deleteAvatar: vi.fn().mockResolvedValue({ id: 'user-1' }),
      changePassword: vi.fn().mockResolvedValue(undefined),
      getSessions: vi.fn().mockResolvedValue([]),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      revokeOtherSessions: vi.fn().mockResolvedValue(undefined),
    };
    service = new ProfileService(repository as unknown as ProfileRepository);
  });

  it('passes a profile update straight through', async () => {
    await service.update({ firstName: 'Adri', phone: null });

    expect(repository.update).toHaveBeenCalledWith({
      firstName: 'Adri',
      phone: null,
    });
  });

  describe('uploadAvatar', () => {
    it('uploads an accepted image', async () => {
      const file = blob('image/png', 1024);

      await service.uploadAvatar(file);

      expect(repository.uploadAvatar).toHaveBeenCalledWith(file);
    });

    it('rejects an unaccepted type without spending the upload', async () => {
      const error = await service
        .uploadAvatar(blob('application/pdf', 1024))
        .catch((e) => e as AppError);

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('PROFILE_CLIENT_010');
      expect(repository.uploadAvatar).not.toHaveBeenCalled();
    });

    it('rejects an image over the ceiling without spending the upload', async () => {
      const error = await service
        .uploadAvatar(blob('image/png', AVATAR_MAX_BYTES + 1))
        .catch((e) => e as AppError);

      expect((error as AppError).code).toBe('PROFILE_CLIENT_011');
      expect(repository.uploadAvatar).not.toHaveBeenCalled();
    });

    it('accepts an image exactly at the ceiling', async () => {
      await service.uploadAvatar(blob('image/webp', AVATAR_MAX_BYTES));

      expect(repository.uploadAvatar).toHaveBeenCalled();
    });

    it('rejects a file with no type at all', async () => {
      // Some pickers hand back an empty MIME type; that must not slip through
      // the allowlist check.
      await expect(service.uploadAvatar(blob('', 10))).rejects.toBeInstanceOf(AppError);
    });
  });

  it('forwards session operations', async () => {
    await service.revokeSession('session-2');
    await service.revokeOtherSessions();

    expect(repository.revokeSession).toHaveBeenCalledWith('session-2');
    expect(repository.revokeOtherSessions).toHaveBeenCalled();
  });
});
