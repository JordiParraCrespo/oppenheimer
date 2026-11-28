import { Not } from 'typeorm';
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
  const outbox = {
    transaction: vi.fn(async (work: (m: typeof manager) => Promise<void>) => work(manager)),
    stageEvents: vi.fn().mockResolvedValue(undefined),
  };
  const userRoles = { setRolesForUser: vi.fn().mockResolvedValue(undefined) };
  const repository = new OrganizationAccessRepository(userRoles as never, outbox as never);
  return { repository, manager, outbox, userRoles };
}

describe('OrganizationAccessRepository.revokeFor', () => {
  it('takes the roles, grants and session selection in one transaction', async () => {
    const { repository, manager, outbox, userRoles } = repositoryWith(null);

    await repository.revokeFor('u1', 'org1');

    expect(outbox.transaction).toHaveBeenCalledOnce();
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

  // Staged on the revocation's own transaction: a listener that revokes the
  // person's pinned tokens hears of every ended membership, and of none that
  // rolled back.
  it('stages the ended membership on the outbox, in the same transaction', async () => {
    const { repository, manager, outbox } = repositoryWith(null);

    await repository.revokeFor('u1', 'org1');

    expect(outbox.stageEvents).toHaveBeenCalledWith(manager, [
      expect.objectContaining({ aggregateId: 'org1', userId: 'u1' }),
    ]);
    expect(outbox.stageEvents.mock.calls[0][1][0].constructor.name).toBe(
      'MembershipEndedDomainEvent',
    );
  });

  it('moves a session to the organization joined first, never the one being left', async () => {
    const { repository, manager } = repositoryWith({ organizationId: 'org-first' });

    await repository.revokeFor('u1', 'org1');

    expect(manager.findOne).toHaveBeenCalledWith(expect.anything(), {
      // Excluded by id, not by trusting Better Auth's delete to have landed.
      where: { userId: 'u1', organizationId: Not('org1') },
      order: { createdAt: 'ASC' },
    });

    expect(manager.update.mock.calls[0][2]).toEqual({
      activeOrganizationId: 'org-first',
      activeTeamId: null,
    });
  });
});
