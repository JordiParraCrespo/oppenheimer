import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../../users/database/user.repository.port';
import { UserEntity } from '../../../../users/domain/user.entity';
import { Email } from '../../../../users/domain/value-objects/email.value-object';
import type { ProfileAuthPort } from '../../../infrastructure/profile-auth.port';
import { ChangeEmailCommand } from '../change-email.command';
import { ChangeEmailCommandHandler } from '../change-email.command-handler';

function makeUser(): UserEntity {
  return UserEntity.create({
    id: 'user-uuid',
    props: {
      email: new Email({ value: 'adri@example.com' }),
      firstName: 'Adri',
      lastName: 'Rodrigo',
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

describe('ChangeEmailCommandHandler', () => {
  const headers = { cookie: 'session=abc' };
  let users: Pick<UserRepositoryPort, 'findOneById'>;
  let auth: Pick<ProfileAuthPort, 'requestEmailChange'>;
  let handler: ChangeEmailCommandHandler;

  beforeEach(() => {
    users = { findOneById: vi.fn().mockResolvedValue(Some(makeUser())) };
    auth = { requestEmailChange: vi.fn().mockResolvedValue(undefined) };
    handler = new ChangeEmailCommandHandler(users as UserRepositoryPort, auth as ProfileAuthPort);
  });

  it('asks for a link to the new address, normalized', async () => {
    await handler.execute(
      new ChangeEmailCommand({ headers, userId: 'user-uuid', newEmail: ' Adri@New.example ' }),
    );

    expect(auth.requestEmailChange).toHaveBeenCalledWith(headers, 'adri@new.example', undefined);
  });

  it('refuses the address the account already uses', async () => {
    const error = await handler
      .execute(
        new ChangeEmailCommand({ headers, userId: 'user-uuid', newEmail: 'ADRI@example.com' }),
      )
      .catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_009');
    expect(auth.requestEmailChange).not.toHaveBeenCalled();
  });

  it('reports a missing profile', async () => {
    users.findOneById = vi.fn().mockResolvedValue(None);

    const error = await handler
      .execute(new ChangeEmailCommand({ headers, userId: 'ghost', newEmail: 'a@b.example' }))
      .catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_001');
  });
});
