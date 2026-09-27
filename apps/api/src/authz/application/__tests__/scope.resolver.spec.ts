import { describe, expect, it, vi } from 'vitest';
import { ScopeResolver } from '../scope.resolver';

/** A grant row as the port hands it back. */
function grant(resourceType: string, resourceId: string | null) {
  return { resourceType, resourceId, isBlanket: () => resourceId === null };
}

/**
 * A resolver over stubbed ports: the caller is in one team and holds one role
 * in the organization, and a single grant is addressed to that role.
 */
function resolverWith() {
  const teamMembers = { find: vi.fn().mockResolvedValue([{ teamId: 'team-1' }]) };
  const teams = { find: vi.fn().mockResolvedValue([{ id: 'team-1' }]) };
  const grants = {
    findActiveForPrincipals: vi.fn().mockResolvedValue([grant('Project', 'project-1')]),
  };
  const userRoles = { findRoleIdsForUser: vi.fn().mockResolvedValue(['role-1']) };
  const resolver = new ScopeResolver(
    teamMembers as never,
    teams as never,
    grants as never,
    userRoles as never,
  );
  return { resolver, teams, grants, userRoles };
}

const input = {
  userId: 'user-1',
  organizationId: 'org-1',
  isPlatformAdmin: false,
  hasFullAccess: false,
};

describe('ScopeResolver', () => {
  it('confers a grant addressed to a role the caller holds', async () => {
    const { resolver } = resolverWith();

    const scope = await resolver.resolve(input);

    expect(scope.grants.get('Project')).toEqual(new Set(['project-1']));
    expect(scope.teamIds).toEqual(['team-1']);
    expect(scope.organizationId).toBe('org-1');
  });

  it('resolves teams, roles and grants all in the organization it is given', async () => {
    const { resolver, teams, grants, userRoles } = resolverWith();

    await resolver.resolve(input);

    // Roles: the caller's global ones plus those scoped to *this* organization.
    expect(userRoles.findRoleIdsForUser).toHaveBeenCalledWith('user-1', 'org-1');
    // Teams: narrowed to this organization, never another tenant's.
    expect(teams.find.mock.calls[0][0].where).toMatchObject({ organizationId: 'org-1' });
    // Grants: in this organization, for the caller, their teams and their roles.
    expect(grants.findActiveForPrincipals).toHaveBeenCalledWith('org-1', [
      { principalType: 'user', principalId: 'user-1' },
      { principalType: 'team', principalId: 'team-1' },
      { principalType: 'role', principalId: 'role-1' },
    ]);
  });

  it('collapses a blanket role grant to the whole resource type', async () => {
    const { resolver, grants } = resolverWith();
    grants.findActiveForPrincipals.mockResolvedValue([
      grant('Project', 'project-1'),
      grant('Project', null),
    ]);

    const scope = await resolver.resolve(input);

    expect(scope.grants.get('Project')).toBe('all');
  });

  it('reads nothing for a request that acts in no organization', async () => {
    const { resolver, grants, userRoles } = resolverWith();

    const scope = await resolver.resolve({ ...input, organizationId: null });

    expect(scope.grants.size).toBe(0);
    expect(userRoles.findRoleIdsForUser).not.toHaveBeenCalled();
    expect(grants.findActiveForPrincipals).not.toHaveBeenCalled();
  });
});
