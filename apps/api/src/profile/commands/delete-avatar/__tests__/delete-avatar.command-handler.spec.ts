import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../../users/database/user.repository.port';
import { UserEntity } from '../../../../users/domain/user.entity';
import { Email } from '../../../../users/domain/value-objects/email.value-object';
import type { AvatarStorageAdapter } from '../../../infrastructure/avatar-storage.adapter';
import { DeleteAvatarCommand } from '../delete-avatar.command';
import { DeleteAvatarCommandHandler } from '../delete-avatar.command-handler';

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

describe('DeleteAvatarCommandHandler', () => {
  let repo: Pick<UserRepositoryPort, 'findOneById' | 'save'>;
  let avatars: { remove: ReturnType<typeof vi.fn> };
  let service: DeleteAvatarCommandHandler;
  let user: UserEntity;

  beforeEach(() => {
    user = makeUser('avatars/user-uuid.png');
    repo = {
      findOneById: vi.fn().mockResolvedValue(Some(user)),
      save: vi.fn().mockImplementation(async (entity) => entity),
    };
    avatars = { remove: vi.fn().mockResolvedValue(undefined) };
    service = new DeleteAvatarCommandHandler(
      repo as UserRepositoryPort,
      avatars as unknown as AvatarStorageAdapter,
    );
  });

  it('clears the profile and removes the object', async () => {
    await service.execute(new DeleteAvatarCommand({ userId: 'user-uuid' }));

    expect(user.avatarUrl).toBeNull();
    expect(avatars.remove).toHaveBeenCalledWith('avatars/user-uuid.png');
  });

  it('saves the profile before removing the object', async () => {
    // The other order can leave a profile pointing at a file that is gone.
    const order: string[] = [];
    repo.save = vi.fn().mockImplementation(async (entity) => {
      order.push('save');
      return entity;
    });
    avatars.remove.mockImplementation(async () => {
      order.push('remove');
    });

    await service.execute(new DeleteAvatarCommand({ userId: 'user-uuid' }));

    expect(order).toEqual(['save', 'remove']);
  });

  it('succeeds when there is no avatar to clear', async () => {
    // The caller asked for a state, not for an event.
    user = makeUser(null);
    repo.findOneById = vi.fn().mockResolvedValue(Some(user));

    await expect(service.execute(new DeleteAvatarCommand({ userId: 'user-uuid' }))).resolves.toBe(
      'user-uuid',
    );
    expect(avatars.remove).toHaveBeenCalledWith(null);
  });

  it('reports a missing profile', async () => {
    repo.findOneById = vi.fn().mockResolvedValue(None);

    const error = await service
      .execute(new DeleteAvatarCommand({ userId: 'ghost' }))
      .catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_001');
    expect(avatars.remove).not.toHaveBeenCalled();
  });
});
