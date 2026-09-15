import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../../users/database/user.repository.port';
import { UserEntity } from '../../../../users/domain/user.entity';
import { Email } from '../../../../users/domain/value-objects/email.value-object';
import { GetProfileQuery } from '../get-profile.query';
import { GetProfileQueryHandler } from '../get-profile.query-handler';

const USER = UserEntity.create({
  id: 'user-uuid',
  props: {
    email: new Email({ value: 'adri@example.com' }),
    firstName: 'Adri',
    lastName: 'Rodrigo',
    phone: null,
    jobTitle: null,
    avatarUrl: null,
    role: 'user',
    isActive: true,
    emailVerified: true,
  },
});

describe('GetProfileQueryHandler', () => {
  let repo: Pick<UserRepositoryPort, 'findOneById'>;
  let handler: GetProfileQueryHandler;

  beforeEach(() => {
    repo = { findOneById: vi.fn().mockResolvedValue(Some(USER)) };
    handler = new GetProfileQueryHandler(repo as UserRepositoryPort);
  });

  it('reads the caller’s own user record', async () => {
    await expect(handler.execute(new GetProfileQuery('user-uuid'))).resolves.toBe(USER);
    expect(repo.findOneById).toHaveBeenCalledWith('user-uuid');
  });

  it('raises the profile code, not the users module’s', async () => {
    // The route is documented with PROFILE_001; USER_001 would leave the
    // `@ApiProblemResponse` on the endpoint describing a code it never returns.
    repo.findOneById = vi.fn().mockResolvedValue(None);

    const error = await handler.execute(new GetProfileQuery('ghost')).catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_001');
  });
});
