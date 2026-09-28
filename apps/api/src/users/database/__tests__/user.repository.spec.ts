import { AppError } from '@oppenheimer/backend-core';
import type { OutboxService } from '@oppenheimer/backend-ddd';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { UserEntity } from '../../domain/user.entity';
import { UserErrors } from '../../domain/user.errors';
import { Email } from '../../domain/value-objects/email.value-object';
import { UserMapper } from '../../user.mapper';
import { UserOrmEntity } from '../user.orm-entity';
import { UserRepository } from '../user.repository';

function user(): UserEntity {
  return UserEntity.create({
    id: 'user-1',
    props: {
      email: new Email({ value: 'ada@example.com' }),
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: null,
      jobTitle: null,
      username: null,
      avatarUrl: null,
      role: 'user',
      isActive: true,
      emailVerified: true,
      banned: false,
      banExpires: null,
    },
  });
}

function repositoryWhoseSaveFails(error: unknown): UserRepository {
  const orm = { target: UserOrmEntity, save: vi.fn().mockRejectedValue(error) };
  const outbox = {
    writeWithEvents: vi.fn(async (_entities: unknown, write: (m: unknown) => unknown) =>
      write({ getRepository: () => orm }),
    ),
  };
  return new UserRepository(
    orm as unknown as Repository<UserOrmEntity>,
    new UserMapper(),
    outbox as unknown as OutboxService,
  );
}

describe('UserRepository.save', () => {
  it('turns the username unique violation into the catalog error', async () => {
    const repository = repositoryWhoseSaveFails({ code: '23505', constraint: 'UQ_user_username' });

    const saving = repository.save(user());

    await expect(saving).rejects.toBeInstanceOf(AppError);
    await expect(saving).rejects.toMatchObject({ code: UserErrors.USERNAME_TAKEN.code });
  });

  it('lets any other failure through unchanged', async () => {
    const failure = { code: '23505', constraint: 'UQ_user_email' };
    const repository = repositoryWhoseSaveFails(failure);

    await expect(repository.save(user())).rejects.toBe(failure);
  });
});
