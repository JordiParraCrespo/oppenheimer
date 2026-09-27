import { In, IsNull } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { RoleOrmEntity } from '../role.orm-entity';
import { UserRoleOrmEntity } from '../user-role.orm-entity';
import { UserRoleRepository } from '../user-role.repository';

/**
 * The adapter over stubbed TypeORM repositories: the installed membership
 * roles are `owner-role` and `user-role`, and every write lands on a recording
 * transaction manager.
 */
function repositoryWith() {
  const inserted: unknown[] = [];
  const insertBuilder = {
    insert: () => insertBuilder,
    into: () => insertBuilder,
    values: (values: unknown) => {
      inserted.push(values);
      return insertBuilder;
    },
    orIgnore: () => insertBuilder,
    execute: vi.fn().mockResolvedValue(undefined),
  };
  const manager = {
    find: vi.fn().mockResolvedValue([{ id: 'owner-role' }, { id: 'user-role' }]),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: () => insertBuilder,
    query: vi.fn().mockResolvedValue(undefined),
  };
  const userRoles = {
    manager: {
      transaction: vi.fn(async (work: (m: typeof manager) => Promise<void>) => work(manager)),
    },
  };
  const repository = new UserRoleRepository(userRoles as never, {} as never, {} as never);
  return { repository, manager, userRoles, inserted };
}

describe('UserRoleRepository.replaceMembershipRole', () => {
  it('removes the other membership role in exactly that organization and grants the new one', async () => {
    const { repository, manager, userRoles, inserted } = repositoryWith();

    await repository.replaceMembershipRole('u1', 'org1', 'owner-role');

    // One transaction, and the candidate rows — only the global system roles a
    // membership maps onto — are read inside it.
    expect(userRoles.manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.find).toHaveBeenCalledWith(
      RoleOrmEntity,
      expect.objectContaining({
        where: { name: In(['owner', 'user']), organizationId: IsNull() },
      }),
    );
    expect(manager.delete).toHaveBeenCalledWith(UserRoleOrmEntity, {
      userId: 'u1',
      organizationId: 'org1',
      roleId: In(['user-role']),
    });
    expect(inserted).toEqual([{ userId: 'u1', roleId: 'owner-role', organizationId: 'org1' }]);
    // Cached abilities in the organization are invalidated in the same transaction.
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('"roleVersion"'), ['org1']);
  });

  it('never touches a custom role scoped to the organization, even one also held globally', async () => {
    const { repository, manager } = repositoryWith();

    await repository.replaceMembershipRole('u1', 'org1', 'user-role');

    // The delete names the membership roles and this organization — a scoped
    // `custom-role` row (whether or not a global `custom-role` row exists
    // beside it) and every global assignment fall outside it.
    const [, criteria] = manager.delete.mock.calls[0];
    expect(criteria).toEqual({ userId: 'u1', organizationId: 'org1', roleId: In(['owner-role']) });
    expect(criteria.organizationId).not.toEqual(IsNull());
  });

  it('only grants when no other membership role is installed', async () => {
    const { repository, manager, inserted } = repositoryWith();
    manager.find.mockResolvedValue([{ id: 'owner-role' }]);

    await repository.replaceMembershipRole('u1', 'org1', 'owner-role');

    expect(manager.delete).not.toHaveBeenCalled();
    expect(inserted).toEqual([{ userId: 'u1', roleId: 'owner-role', organizationId: 'org1' }]);
  });
});
