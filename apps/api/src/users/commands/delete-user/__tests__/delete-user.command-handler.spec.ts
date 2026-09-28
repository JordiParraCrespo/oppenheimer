import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountErasurePort } from '../../../application/account-erasure.port';
import { AccountErasureRegistry } from '../../../application/account-erasure.registry';
import type { UserRepositoryPort } from '../../../database/user.repository.port';
import { UserEntity } from '../../../domain/user.entity';
import { UserErrors } from '../../../domain/user.errors';
import { Email } from '../../../domain/value-objects/email.value-object';
import { DeleteUserCommand } from '../delete-user.command';
import { DeleteUserCommandHandler } from '../delete-user.command-handler';

function makeUser(): UserEntity {
  return UserEntity.create({
    id: 'user-uuid',
    props: {
      email: new Email({ value: 'test@example.com' }),
      firstName: 'Test',
      lastName: 'User',
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

describe('DeleteUserCommandHandler', () => {
  let service: DeleteUserCommandHandler;
  let repo: Pick<UserRepositoryPort, 'findOneById' | 'delete'>;
  let calls: string[];

  const contribution = (step: AccountErasurePort['step']): AccountErasurePort => ({
    step,
    eraseFor: vi.fn(async () => {
      calls.push(step);
    }),
  });

  beforeEach(() => {
    calls = [];
    repo = {
      findOneById: vi.fn().mockResolvedValue(Some(makeUser())),
      delete: vi.fn(async () => {
        calls.push('user');
        return true;
      }),
    };
    const registry = new AccountErasureRegistry();
    // Registered out of order on purpose: the registry, not boot order, decides.
    registry.registerAll([
      contribution('workspace'),
      contribution('sessions'),
      contribution('hosts'),
      contribution('projects'),
    ]);
    service = new DeleteUserCommandHandler(repo as UserRepositoryPort, registry);
  });

  it('erases what the account holds in step order, then the user', async () => {
    await service.execute(new DeleteUserCommand({ userId: 'user-uuid' }));

    expect(calls).toEqual(['hosts', 'sessions', 'projects', 'workspace', 'user']);
  });

  it('deletes the user and raises the deletion event on the aggregate', async () => {
    await service.execute(new DeleteUserCommand({ userId: 'user-uuid' }));

    const deleted = vi.mocked(repo.delete).mock.calls[0][0] as UserEntity;
    expect(deleted.domainEvents).toHaveLength(1);
    expect(deleted.domainEvents[0]).toMatchObject({ email: 'test@example.com' });
  });

  it('accepts the account’s own email as confirmation, in any case', async () => {
    await service.execute(
      new DeleteUserCommand({ userId: 'user-uuid', confirmation: ' TEST@example.com ' }),
    );

    expect(repo.delete).toHaveBeenCalled();
  });

  it('refuses any other confirmation, and erases nothing', async () => {
    await expect(
      service.execute(new DeleteUserCommand({ userId: 'user-uuid', confirmation: 'nope' })),
    ).rejects.toMatchObject({ code: UserErrors.DELETE_CONFIRMATION_MISMATCH.code });
    expect(calls).toEqual([]);
  });

  it('throws NOT_FOUND when the user does not exist', async () => {
    vi.mocked(repo.findOneById).mockResolvedValue(None);

    await expect(
      service.execute(new DeleteUserCommand({ userId: 'bad-uuid' })),
    ).rejects.toMatchObject({ code: UserErrors.NOT_FOUND.code });
  });
});
