import { describe, expect, it, vi } from 'vitest';
import { Session } from '../../../auth/database/session.orm-entity';
import { AccessGrantOrmEntity } from '../../../authz/database/access-grant.orm-entity';
import { OrganizationAccessRepository } from '../organization-access.repository';

function repositoryWith(fallback: { organizationId: string } | null) {
  const manager = {
    delete: vi.fn().mockResolvedValue({ affected: 0 }),
    findOne: vi.fn().mockResolvedValue(fallback),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const dataSource = {
    transaction: vi.fn(async (work: (m: typeof manager) => Promise<void>) => work(manager)),
  };
  const userRoles = { setRolesForUser: vi.fn().mockResolvedValue(undefined) };
  const repository = new OrganizationAccessRepository(dataSource as never, userRoles as never);
  return { repository, manager, dataSource, userRoles };
}

describe('OrganizationAccessRepository.revokeFor', () => {
  it('takes the roles, grants and session selection in one transaction', async () => {
    const { repository, manager, dataSource, userRoles } = repositoryWith(null);

    await repository.revokeFor('u1', 'org1');

    expect(dataSource.transaction).toHaveBeenCalledOnce();
    // The roles module writes its own table, on this transaction's manager.
    expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u1', [], 'org1', manager);
    expect(manager.delete).toHaveBeenCalledWith(AccessGrantOrmEntity, {
      organizationId: 'org1',
      principalType: 'user',
      principalId: 'u1',
    });
    expect(manager.update).toHaveBeenCalledWith(
      Session,
      { userId: 'u1', activeOrganizationId: 'org1' },
      { activeOrganizationId: null, activeTeamId: null },
    );
  });

  it('moves a session to the organization the person joined first', async () => {
    const { repository, manager } = repositoryWith({ organizationId: 'org-first' });

    await repository.revokeFor('u1', 'org1');

    expect(manager.update.mock.calls[0][2]).toEqual({
      activeOrganizationId: 'org-first',
      activeTeamId: null,
    });
  });
});
