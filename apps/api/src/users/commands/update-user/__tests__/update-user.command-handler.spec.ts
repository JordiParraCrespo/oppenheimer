import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../database/user.repository.port';
import { UserEntity } from '../../../domain/user.entity';
import { UserErrors } from '../../../domain/user.errors';
import { Email } from '../../../domain/value-objects/email.value-object';
import { UpdateUserCommand } from '../update-user.command';
import { UpdateUserCommandHandler } from '../update-user.command-handler';

function makeUser(): UserEntity {
  return UserEntity.create({
    id: 'user-uuid',
    props: {
      email: new Email({ value: 'test@example.com' }),
      firstName: 'Test',
      lastName: 'User',
      phone: null,
      jobTitle: null,
      avatarUrl: null,
      role: 'user',
      isActive: true,
      emailVerified: true,
    },
  });
}

describe('UpdateUserCommandHandler', () => {
  let service: UpdateUserCommandHandler;
  let repo: Pick<UserRepositoryPort, 'findOneById' | 'save'>;

  beforeEach(() => {
    repo = {
      findOneById: vi.fn().mockResolvedValue(Some(makeUser())),
      save: vi.fn().mockImplementation((user: UserEntity) => Promise.resolve(user)),
    };
    service = new UpdateUserCommandHandler(repo as UserRepositoryPort);
  });

  it('applies the profile update through the aggregate and persists it', async () => {
    const id = await service.execute(
      new UpdateUserCommand({
        userId: 'user-uuid',
        firstName: 'Updated',
        isActive: false,
      }),
    );

    expect(id).toBe('user-uuid');
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(repo.save).mock.calls[0][0] as UserEntity;
    expect(saved.firstName).toBe('Updated');
    expect(saved.isActive).toBe(false);
    // Unchanged fields are preserved.
    expect(saved.lastName).toBe('User');
  });

  it('throws NOT_FOUND when the user does not exist', async () => {
    vi.mocked(repo.findOneById).mockResolvedValue(None);

    await expect(
      service.execute(new UpdateUserCommand({ userId: 'bad-uuid', firstName: 'X' })),
    ).rejects.toMatchObject({ code: UserErrors.NOT_FOUND.code });
  });
});
