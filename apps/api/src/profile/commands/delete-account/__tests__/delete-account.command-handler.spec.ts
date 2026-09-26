import { AppError } from '@oppenheimer/backend-core';
import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../../users/database/user.repository.port';
import { UserEntity } from '../../../../users/domain/user.entity';
import { Email } from '../../../../users/domain/value-objects/email.value-object';
import type { AccountErasurePort } from '../../../database/account-erasure.repository.port';
import type { AvatarStoragePort } from '../../../infrastructure/avatar-storage.port';
import type { WorkspaceShutdownPort } from '../../../infrastructure/workspace-shutdown.port';
import { DeleteAccountCommand } from '../delete-account.command';
import { DeleteAccountCommandHandler } from '../delete-account.command-handler';

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
      avatarUrl: 'avatars/user-uuid.png',
      role: 'user',
      isActive: true,
      emailVerified: true,
    },
  });
}

describe('DeleteAccountCommandHandler', () => {
  let user: UserEntity;
  let calls: string[];
  let users: Pick<UserRepositoryPort, 'findOneById' | 'delete'>;
  let erasure: AccountErasurePort;
  let shutdown: WorkspaceShutdownPort;
  let avatars: Pick<AvatarStoragePort, 'remove'>;
  let handler: DeleteAccountCommandHandler;

  const record = (name: string) => async () => {
    calls.push(name);
  };

  beforeEach(() => {
    user = makeUser();
    calls = [];
    users = {
      findOneById: vi.fn().mockResolvedValue(Some(user)),
      delete: vi.fn().mockImplementation(async () => {
        calls.push('deleteUser');
        return true;
      }),
    };
    erasure = {
      findSoleWorkspaces: vi.fn().mockResolvedValue(['org-1']),
      hasSharedWork: vi.fn().mockResolvedValue(false),
      eraseWorkspaces: vi.fn().mockImplementation(record('erase')),
    };
    shutdown = {
      stopSessions: vi.fn().mockImplementation(record('stopSessions')),
      unpairHosts: vi.fn().mockImplementation(record('unpairHosts')),
    };
    avatars = { remove: vi.fn().mockImplementation(record('removeAvatar')) };
    handler = new DeleteAccountCommandHandler(
      users as UserRepositoryPort,
      erasure,
      shutdown,
      avatars as AvatarStoragePort,
    );
  });

  const run = (confirmation = 'adri@example.com') =>
    handler.execute(new DeleteAccountCommand({ userId: 'user-uuid', confirmation }));

  it('tells the hosts first, erases, deletes the user, then the avatar', async () => {
    await run();

    expect(calls).toEqual(['stopSessions', 'unpairHosts', 'erase', 'deleteUser', 'removeAvatar']);
    expect(shutdown.stopSessions).toHaveBeenCalledWith('user-uuid', ['org-1']);
    expect(erasure.eraseWorkspaces).toHaveBeenCalledWith('user-uuid', ['org-1']);
    expect(avatars.remove).toHaveBeenCalledWith('avatars/user-uuid.png');
  });

  it('accepts the email typed in another case, with spaces around it', async () => {
    await run('  ADRI@example.com ');

    expect(users.delete).toHaveBeenCalledWith(user);
  });

  it('refuses a confirmation that is not the email, and touches nothing', async () => {
    const error = await run('adri').catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_010');
    expect(calls).toEqual([]);
  });

  it('refuses when there is work in a shared workspace, before stopping anything', async () => {
    erasure.hasSharedWork = vi.fn().mockResolvedValue(true);

    const error = await run().catch((e) => e as AppError);

    expect((error as AppError).code).toBe('PROFILE_011');
    expect(calls).toEqual([]);
  });
});
