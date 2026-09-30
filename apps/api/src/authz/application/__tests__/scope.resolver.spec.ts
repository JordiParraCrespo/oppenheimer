import { describe, expect, it, vi } from 'vitest';
import { TeamOrmEntity } from '../../../organizations/database/team.orm-entity';
import { ScopeResolver } from '../scope.resolver';

function grant(resourceType: string, resourceId: string | null) {
  return { resourceType, resourceId, isBlanket: () => resourceId === null };
}

/**
 * A resolver over stubbed ports: the caller is in one team and holds one role
 * in the organization, and a single grant is addressed to that role. Team
 * membership is one query builder chain, recorded.
 */
function resolverWith() {
  const teamQuery = {
    innerJoin: vi.fn(() => teamQuery),
    where: vi.fn(() => teamQuery),
    andWhere: vi.fn(() => teamQuery),
    select: vi.fn(() => teamQuery),
    getRawMany: vi.fn().mockResolvedValue([{ teamId: 'team-1' }]),
  };
  const teamMembers = { createQueryBuilder: vi.fn(() => teamQuery) };
  const grants = {
    findActiveForPrincipals: vi.fn().mockResolvedValue([grant('Project', 'project-1')]),
  };
  const userRoles = { findRoleIdsForUser: vi.fn().mockResolvedValue(['role-1']) };
  const resolver = new ScopeResolver(teamMembers as never, grants as never, userRoles as never);
  return { resolver, teamMembers, teamQuery, grants, userRoles };
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
    const { resolver, teamQuery, grants, userRoles } = resolverWith();

    await resolver.resolve(input);

    // Roles: the caller's global ones plus those scoped to *this* organization.
    expect(userRoles.findRoleIdsForUser).toHaveBeenCalledWith('user-1', 'org-1');
    // Teams: narrowed to this organization, never another tenant's.
    expect(teamQuery.andWhere).toHaveBeenCalledWith(expect.stringContaining('organizationId'), {
      organizationId: 'org-1',
    });
    expect(grants.findActiveForPrincipals).toHaveBeenCalledWith('org-1', [
      { principalType: 'user', principalId: 'user-1' },
      { principalType: 'team', principalId: 'team-1' },
      { principalType: 'role', principalId: 'role-1' },
    ]);
  });

  it('reads team membership in one query, joined to the team for the tenant', async () => {
    const { resolver, teamMembers, teamQuery } = resolverWith();

    await resolver.resolve(input);

    expect(teamMembers.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(teamQuery.innerJoin).toHaveBeenCalledWith(TeamOrmEntity, 't', expect.any(String));
    expect(teamQuery.where).toHaveBeenCalledWith(expect.stringContaining('userId'), {
      userId: 'user-1',
    });
    expect(teamQuery.getRawMany).toHaveBeenCalledTimes(1);
  });

  it('uses the role ids it is handed instead of reading user_role again', async () => {
    const { resolver, grants, userRoles } = resolverWith();

    await resolver.resolve({ ...input, roleIds: ['role-from-ability'] });

    expect(userRoles.findRoleIdsForUser).not.toHaveBeenCalled();
    expect(grants.findActiveForPrincipals).toHaveBeenCalledWith(
      'org-1',
      expect.arrayContaining([{ principalType: 'role', principalId: 'role-from-ability' }]),
    );
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

  it.each([
    ['a platform admin', { isPlatformAdmin: true }],
    ['a `manage all` holder', { hasFullAccess: true }],
  ])('short-circuits for %s and reads nothing', async (_name, flags) => {
    const { resolver, teamMembers, grants, userRoles } = resolverWith();

    const scope = await resolver.resolve({ ...input, ...flags });

    expect(scope.bypass).toBe(true);
    expect(teamMembers.createQueryBuilder).not.toHaveBeenCalled();
    expect(userRoles.findRoleIdsForUser).not.toHaveBeenCalled();
    expect(grants.findActiveForPrincipals).not.toHaveBeenCalled();
  });

  it('reads nothing for a request that acts in no organization', async () => {
    const { resolver, grants, userRoles } = resolverWith();

    const scope = await resolver.resolve({ ...input, organizationId: null });

    expect(scope.grants.size).toBe(0);
    expect(userRoles.findRoleIdsForUser).not.toHaveBeenCalled();
    expect(grants.findActiveForPrincipals).not.toHaveBeenCalled();
  });
});
