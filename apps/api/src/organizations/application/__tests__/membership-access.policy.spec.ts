import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipAccessPolicy } from '../membership-access.policy';

describe('MembershipAccessPolicy', () => {
  const roles = { findOneByName: vi.fn() };
  const userRoles = {
    setRolesForUser: vi.fn().mockResolvedValue(undefined),
    replaceMembershipRole: vi.fn().mockResolvedValue(undefined),
  };
  const access = { revokeFor: vi.fn().mockResolvedValue(undefined) };
  const sessionCache = { refreshUser: vi.fn().mockResolvedValue(undefined) };
  let policy: MembershipAccessPolicy;

  beforeEach(() => {
    vi.clearAllMocks();
    roles.findOneByName.mockImplementation(async (name: string) => Some({ id: `${name}-role` }));
    policy = new MembershipAccessPolicy(
      roles as never,
      userRoles as never,
      access as never,
      sessionCache as never,
    );
  });

  describe('grant', () => {
    it.each([
      ['owner', 'owner'],
      ['admin', 'owner'],
      ['member', 'user'],
      ['member, admin', 'owner'],
    ])('maps the %s organization role onto the org-scoped %s role', async (orgRole, appRole) => {
      await policy.grant('u1', 'org1', orgRole);

      expect(roles.findOneByName).toHaveBeenCalledExactlyOnceWith(appRole, null);
      expect(userRoles.replaceMembershipRole).toHaveBeenCalledWith('u1', 'org1', `${appRole}-role`);
    });

    it('swaps only the membership role, leaving every other assignment alone', async () => {
      await policy.grant('u1', 'org1', 'admin');
      expect(userRoles.setRolesForUser).not.toHaveBeenCalled();
    });

    it('refuses a membership whose system role is not installed (ROLE_007)', async () => {
      roles.findOneByName.mockResolvedValue(None);

      await expect(policy.grant('u1', 'org1', 'member')).rejects.toMatchObject({
        code: 'ROLE_007',
      });
      expect(userRoles.replaceMembershipRole).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('clears the roles, grants and session selection the organization gave', async () => {
      await policy.revoke('u1', 'org1');

      expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u1', [], 'org1');
      expect(access.revokeFor).toHaveBeenCalledWith('u1', 'org1');
    });

    // The rows were written behind Better Auth's back; its cached copies of
    // them must follow, or the removed member keeps the organization.
    it('refreshes the cached sessions after the rows are written', async () => {
      await policy.revoke('u1', 'org1');

      expect(sessionCache.refreshUser).toHaveBeenCalledWith('u1');
      expect(sessionCache.refreshUser.mock.invocationCallOrder[0]).toBeGreaterThan(
        access.revokeFor.mock.invocationCallOrder[0],
      );
    });
  });
});
