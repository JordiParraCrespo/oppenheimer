import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../../users/database/user.repository.port';
import { UserEntity } from '../../../../users/domain/user.entity';
import { Email } from '../../../../users/domain/value-objects/email.value-object';
import type { AvatarStorage } from '../../../services/avatar.storage';
import { UploadAvatarCommand } from '../upload-avatar.command';
import { UploadAvatarService } from '../upload-avatar.service';

function makeUser(avatarUrl: string | null): UserEntity {
  return UserEntity.create({
    id: 'user-uuid',
    props: {
      email: new Email({ value: 'adri@example.com' }),
      firstName: 'Adri',
      lastName: 'Rodrigo',
      phone: null,
      jobTitle: null,
      avatarUrl,
      role: 'user',
      isActive: true,
      emailVerified: true,
    },
  });
}

function command(): UploadAvatarCommand {
  return new UploadAvatarCommand({
    userId: 'user-uuid',
    buffer: Buffer.from('png'),
    mimeType: 'image/png',
    size: 3,
  });
}

describe('UploadAvatarService', () => {
  let repo: Pick<UserRepositoryPort, 'findOneById' | 'save'>;
  let avatars: {
    store: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let service: UploadAvatarService;
  let user: UserEntity;

  beforeEach(() => {
    user = makeUser('avatars/user-uuid.jpg');
    repo = {
      findOneById: vi.fn().mockResolvedValue(Some(user)),
      save: vi.fn().mockImplementation(async (entity) => entity),
    };
    avatars = {
      store: vi.fn().mockResolvedValue('avatars/user-uuid.png'),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    service = new UploadAvatarService(
      repo as UserRepositoryPort,
      avatars as unknown as AvatarStorage,
    );
  });

  it('points the profile at the new key', async () => {
    await service.execute(command());

    expect(avatars.store).toHaveBeenCalledWith('user-uuid', expect.any(Buffer), 'image/png', 3);
    expect(user.avatarUrl).toBe('avatars/user-uuid.png');
    expect(repo.save).toHaveBeenCalledWith(user);
  });

  it('removes the previous object only after the profile is saved', async () => {
    // The other order leaves a profile pointing at a deleted file if the save
    // fails.
    const order: string[] = [];
    repo.save = vi.fn().mockImplementation(async (entity) => {
      order.push('save');
      return entity;
    });
    avatars.remove.mockImplementation(async () => {
      order.push('remove');
    });

    await service.execute(command());

    expect(order).toEqual(['save', 'remove']);
    expect(avatars.remove).toHaveBeenCalledWith('avatars/user-uuid.jpg');
  });

  it('does not delete the object it just wrote when the key is unchanged', async () => {
    user = makeUser('avatars/user-uuid.png');
    repo.findOneById = vi.fn().mockResolvedValue(Some(user));

    await service.execute(command());

    expect(avatars.remove).not.toHaveBeenCalled();
    expect(user.avatarUrl).toBe('avatars/user-uuid.png');
  });

  it('leaves the old avatar in place when storing the new one fails', async () => {
    avatars.store = vi.fn().mockRejectedValue(
      new AppError({
        code: 'PROFILE_004',
        message: 'That file type is not supported for an avatar',
        httpStatus: 415,
      }),
    );

    await expect(service.execute(command())).rejects.toBeInstanceOf(AppError);

    expect(user.avatarUrl).toBe('avatars/user-uuid.jpg');
    expect(repo.save).not.toHaveBeenCalled();
    expect(avatars.remove).not.toHaveBeenCalled();
  });

  it('reports a missing profile', async () => {
    repo.findOneById = vi.fn().mockResolvedValue(None);

    const error = await service.execute(command()).catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_001');
    expect(avatars.store).not.toHaveBeenCalled();
  });
});
