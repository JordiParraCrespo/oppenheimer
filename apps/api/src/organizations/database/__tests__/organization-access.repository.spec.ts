import { describe, expect, it, vi } from 'vitest';
import { OrganizationAccessRepository } from '../organization-access.repository';

describe('OrganizationAccessRepository.revokeFor', () => {
  it('deletes the grants and moves a session off the organization', async () => {
    const accessGrants = { delete: vi.fn().mockResolvedValue({ affected: 0 }) };
    const members = { findOne: vi.fn().mockResolvedValue(null) };
    const sessions = { update: vi.fn().mockResolvedValue({ affected: 1 }) };
    const repository = new OrganizationAccessRepository(
      accessGrants as never,
      members as never,
      sessions as never,
    );

    await repository.revokeFor('u1', 'org1');

    expect(accessGrants.delete).toHaveBeenCalledWith({
      organizationId: 'org1',
      principalType: 'user',
      principalId: 'u1',
    });
    expect(sessions.update).toHaveBeenCalledWith(
      { userId: 'u1', activeOrganizationId: 'org1' },
      { activeOrganizationId: null, activeTeamId: null },
    );
  });

  it('falls back to the organization the person joined first', async () => {
    const sessions = { update: vi.fn().mockResolvedValue({ affected: 1 }) };
    const repository = new OrganizationAccessRepository(
      { delete: vi.fn() } as never,
      { findOne: vi.fn().mockResolvedValue({ organizationId: 'org-first' }) } as never,
      sessions as never,
    );

    await repository.revokeFor('u1', 'org1');

    expect(sessions.update.mock.calls[0][1]).toEqual({
      activeOrganizationId: 'org-first',
      activeTeamId: null,
    });
  });
});
