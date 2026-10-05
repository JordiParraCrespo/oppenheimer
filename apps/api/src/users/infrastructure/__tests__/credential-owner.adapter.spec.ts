import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../database/user.repository.port';
import { UserEntity, type UserProps } from '../../domain/user.entity';
import { Email } from '../../domain/value-objects/email.value-object';
import { UserMapper } from '../../user.mapper';
import { UserCredentialOwnerAdapter } from '../credential-owner.adapter';

const minute = 60 * 1000;

function makeUser(standing: Partial<Pick<UserProps, 'isActive' | 'banned' | 'banExpires'>>) {
  return UserEntity.create({
    id: 'user-uuid',
    props: {
      email: new Email({ value: 'owner@example.com' }),
      firstName: 'Owner',
      lastName: 'Example',
      phone: null,
      jobTitle: null,
      username: null,
      avatarUrl: null,
      role: 'user',
      isActive: true,
      emailVerified: true,
      banned: false,
      banExpires: null,
      ...standing,
    },
  });
}

describe('UserCredentialOwnerAdapter', () => {
  let users: Pick<UserRepositoryPort, 'findOneById'>;
  let adapter: UserCredentialOwnerAdapter;

  beforeEach(() => {
    users = { findOneById: vi.fn() };
    adapter = new UserCredentialOwnerAdapter(users as UserRepositoryPort, new UserMapper());
  });

  const withOwner = (user: UserEntity) =>
    vi.mocked(users.findOneById).mockResolvedValue(Some(user));

  it('returns an active owner who is not banned', async () => {
    withOwner(makeUser({}));
    await expect(adapter.findActiveOwner('user-uuid')).resolves.toMatchObject({ id: 'user-uuid' });
  });

  it('refuses a missing owner', async () => {
    vi.mocked(users.findOneById).mockResolvedValue(None);
    await expect(adapter.findActiveOwner('user-uuid')).resolves.toBeNull();
  });

  it('refuses a deactivated owner', async () => {
    withOwner(makeUser({ isActive: false }));
    await expect(adapter.findActiveOwner('user-uuid')).resolves.toBeNull();
  });

  it('refuses an owner banned with no expiry', async () => {
    // Regression: only `isActive` was checked, so a banned owner's API tokens
    // and OAuth grants kept working.
    withOwner(makeUser({ banned: true, banExpires: null }));
    await expect(adapter.findActiveOwner('user-uuid')).resolves.toBeNull();
  });

  it('refuses an owner whose ban has not expired yet', async () => {
    withOwner(makeUser({ banned: true, banExpires: new Date(Date.now() + 60 * minute) }));
    await expect(adapter.findActiveOwner('user-uuid')).resolves.toBeNull();
  });

  it('accepts an owner whose ban has expired, before the plugin lifts it', async () => {
    withOwner(makeUser({ banned: true, banExpires: new Date(Date.now() - minute) }));
    await expect(adapter.findActiveOwner('user-uuid')).resolves.toMatchObject({ id: 'user-uuid' });
  });

  describe('requireActiveOwner', () => {
    it('answers the owner who may act', async () => {
      withOwner(makeUser({}));
      await expect(adapter.requireActiveOwner('user-uuid')).resolves.toMatchObject({
        id: 'user-uuid',
      });
    });

    it('refuses anyone else with the opaque credential error', async () => {
      withOwner(makeUser({ isActive: false }));
      await expect(adapter.requireActiveOwner('user-uuid')).rejects.toMatchObject({
        code: 'TOKEN_003',
      });
    });
  });
});
