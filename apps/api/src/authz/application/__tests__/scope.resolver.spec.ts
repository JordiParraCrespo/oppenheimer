import { describe, expect, it, vi } from 'vitest';
import { ScopeResolver } from '../scope.resolver';

/** A resolver over stubbed ports: one team, one role, no grants yet. */
function resolverWith() {
  const teamMembers = { find: vi.fn().mockResolvedValue([{ teamId: 'team-1' }]) };
  const teams = { find: vi.fn().mockResolvedValue([{ id: 'team-1' }]) };
  const grants = { findActiveForPrincipals: vi.fn().mockResolvedValue([]) };
  const userRoles = { findRoleIdsForUser: vi.fn().mockResolvedValue(['role-1']) };
  const resolver = new ScopeResolver(
    teamMembers as never,
    teams as never,
    grants as never,
    userRoles as never,
  );
  return { resolver, grants, userRoles };
}

describe('ScopeResolver', () => {
  it('reads grants addressed to the caller, their teams and the roles they hold here', async () => {
    const { resolver, grants, userRoles } = resolverWith();

    await resolver.resolve({
      userId: 'user-1',
      organizationId: 'org-1',
      isPlatformAdmin: false,
      hasFullAccess: false,
    });

    expect(userRoles.findRoleIdsForUser).toHaveBeenCalledWith('user-1', 'org-1');
    expect(grants.findActiveForPrincipals).toHaveBeenCalledWith('org-1', [
      { principalType: 'user', principalId: 'user-1' },
      { principalType: 'team', principalId: 'team-1' },
      { principalType: 'role', principalId: 'role-1' },
    ]);
  });
});
