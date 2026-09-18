import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../../users/database/user.repository.port';
import { UserEntity } from '../../../../users/domain/user.entity';
import { Email } from '../../../../users/domain/value-objects/email.value-object';
import { UpdateProfileCommand } from '../update-profile.command';
import { UpdateProfileCommandHandler } from '../update-profile.command-handler';

function makeUser(): UserEntity {
  return UserEntity.create({
    id: 'user-uuid',
    props: {
      email: new Email({ value: 'adri@example.com' }),
      firstName: 'Adri',
      lastName: 'Rodrigo',
      phone: '+34 600 123 456',
      jobTitle: 'Founder',
      avatarUrl: 'avatars/user-uuid.png',
      role: 'user',
      isActive: true,
      emailVerified: true,
    },
  });
}

describe('UpdateProfileCommandHandler', () => {
  let service: UpdateProfileCommandHandler;
  let repo: Pick<UserRepositoryPort, 'findOneById' | 'save'>;
  let user: UserEntity;

  beforeEach(() => {
    user = makeUser();
    repo = {
      findOneById: vi.fn().mockResolvedValue(Some(user)),
      save: vi.fn().mockImplementation(async (entity) => entity),
    };
    service = new UpdateProfileCommandHandler(repo as UserRepositoryPort);
  });

  it('applies the fields it was given', async () => {
    await service.execute(
      new UpdateProfileCommand({
        userId: 'user-uuid',
        firstName: 'Adrián',
        jobTitle: 'SEO lead',
      }),
    );

    expect(user.firstName).toBe('Adrián');
    expect(user.jobTitle).toBe('SEO lead');
    expect(repo.save).toHaveBeenCalledWith(user);
  });

  it('leaves fields it was not given alone', async () => {
    await service.execute(new UpdateProfileCommand({ userId: 'user-uuid', firstName: 'Adrián' }));

    expect(user.lastName).toBe('Rodrigo');
    expect(user.phone).toBe('+34 600 123 456');
  });

  it('clears a field set to null', async () => {
    // `undefined` means "leave it"; only an explicit null empties a field, so a
    // client can clear a phone number without resending the whole card.
    await service.execute(new UpdateProfileCommand({ userId: 'user-uuid', phone: null }));

    expect(user.phone).toBeNull();
    expect(user.jobTitle).toBe('Founder');
  });

  it('never touches the avatar', async () => {
    // Avatars have their own endpoints; a profile save must not blank one.
    await service.execute(new UpdateProfileCommand({ userId: 'user-uuid', firstName: 'Adrián' }));

    expect(user.avatarUrl).toBe('avatars/user-uuid.png');
  });

  it('cannot change the role, even if one is smuggled into the props', async () => {
    // The command has no `role` field at all — this pins that, since the
    // handler is the only thing between a request body and the user aggregate.
    await service.execute(
      new UpdateProfileCommand({
        userId: 'user-uuid',
        ...({ role: 'admin', isActive: false } as object),
      }),
    );

    expect(user.role).toBe('user');
    expect(user.isActive).toBe(true);
  });

  it('reports a missing profile', async () => {
    repo.findOneById = vi.fn().mockResolvedValue(None);

    const error = await service
      .execute(new UpdateProfileCommand({ userId: 'ghost' }))
      .catch((e) => e as AppError);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('PROFILE_001');
  });
});
