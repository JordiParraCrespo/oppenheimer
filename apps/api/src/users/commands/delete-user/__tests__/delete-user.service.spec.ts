import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../database/user.repository.port';
import { UserEntity } from '../../../domain/user.entity';
import { UserErrors } from '../../../domain/user.errors';
import { Email } from '../../../domain/value-objects/email.value-object';
import { DeleteUserCommand } from '../delete-user.command';
import { DeleteUserService } from '../delete-user.service';

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

describe('DeleteUserService', () => {
  let service: DeleteUserService;
  let repo: Pick<UserRepositoryPort, 'findOneById' | 'delete'>;

  beforeEach(() => {
    repo = {
      findOneById: vi.fn().mockResolvedValue(Some(makeUser())),
      delete: vi.fn().mockResolvedValue(true),
    };
    service = new DeleteUserService(repo as UserRepositoryPort);
  });

  it('deletes the user and raises the deletion event on the aggregate', async () => {
    await service.execute(new DeleteUserCommand({ userId: 'user-uuid' }));

    expect(repo.delete).toHaveBeenCalledTimes(1);
    const deleted = vi.mocked(repo.delete).mock.calls[0][0] as UserEntity;
    expect(deleted.domainEvents).toHaveLength(1);
    expect(deleted.domainEvents[0]).toMatchObject({
      email: 'test@example.com',
    });
  });

  it('throws NOT_FOUND when the user does not exist', async () => {
    vi.mocked(repo.findOneById).mockResolvedValue(None);

    await expect(
      service.execute(new DeleteUserCommand({ userId: 'bad-uuid' })),
    ).rejects.toMatchObject({ code: UserErrors.NOT_FOUND.code });
  });
});
