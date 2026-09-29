import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipAccessPolicy } from '../membership-access.policy';

const entry = (role: string) => ({ userId: 'u1', organizationId: 'org1', role });

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
    userRoles.replaceMembershipRole.mockResolvedValue(undefined);
    policy = new MembershipAccessPolicy(
      roles as never,
      userRoles as never,
      access as never,
      sessionCache as never,
    );
  });

  describe('admit', () => {
    it.each([
      ['owner', 'owner'],
      ['admin', 'owner'],
      ['member', 'user'],
      ['member, admin', 'owner'],
    ])('grants the %s organization role the org-scoped %s role', async (orgRole, appRole) => {
      const undo = vi.fn();

      const admitted = await policy.admit(async () => entry(orgRole), undo);

      expect(admitted).toEqual(entry(orgRole));
      expect(roles.findOneByName).toHaveBeenCalledExactlyOnceWith(appRole, null);
      expect(userRoles.replaceMembershipRole).toHaveBeenCalledWith('u1', 'org1', `${appRole}-role`);
      expect(undo).not.toHaveBeenCalled();
    });

    it('swaps only the membership role, leaving every other assignment alone', async () => {
      await policy.admit(async () => entry('admin'), vi.fn());
      expect(userRoles.setRolesForUser).not.toHaveBeenCalled();
    });

    // The #106 failure, on every door: a roster row the app will not let its
    // member use. The roster write is undone and the reason surfaces.
    it('undoes the roster write when the system role is not installed (ROLE_007)', async () => {
      roles.findOneByName.mockResolvedValue(None);
      const undo = vi.fn().mockResolvedValue(undefined);

      await expect(policy.admit(async () => entry('member'), undo)).rejects.toMatchObject({
        code: 'ROLE_007',
      });
      expect(undo).toHaveBeenCalledWith(entry('member'));
      expect(userRoles.replaceMembershipRole).not.toHaveBeenCalled();
    });

    it('undoes the roster write when the grant itself fails', async () => {
      const failure = new Error('role store unavailable');
      userRoles.replaceMembershipRole.mockRejectedValue(failure);
      const undo = vi.fn().mockResolvedValue(undefined);

      await expect(policy.admit(async () => entry('member'), undo)).rejects.toBe(failure);
      expect(undo).toHaveBeenCalledOnce();
    });

    it('reports the original failure even when the undo fails too', async () => {
      const failure = new Error('role store unavailable');
      userRoles.replaceMembershipRole.mockRejectedValue(failure);

      await expect(
        policy.admit(async () => entry('member'), vi.fn().mockRejectedValue(new Error('undo'))),
      ).rejects.toBe(failure);
    });

    it('grants nothing and undoes nothing when the roster write fails', async () => {
      const undo = vi.fn();
      await expect(policy.admit(() => Promise.reject(new Error('refused')), undo)).rejects.toThrow(
        'refused',
      );
      expect(userRoles.replaceMembershipRole).not.toHaveBeenCalled();
      expect(undo).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    // The rows were written behind Better Auth's back; its cached copies of
    // them must follow, or the removed member keeps the organization.
    it('takes the access in one write, then refreshes the cached sessions', async () => {
      await policy.revoke('u1', 'org1');

      expect(access.revokeFor).toHaveBeenCalledWith('u1', 'org1');
      expect(sessionCache.refreshUser).toHaveBeenCalledWith('u1');
      expect(sessionCache.refreshUser.mock.invocationCallOrder[0]).toBeGreaterThan(
        access.revokeFor.mock.invocationCallOrder[0],
      );
    });

    it('leaves the cache alone when the revocation did not commit', async () => {
      access.revokeFor.mockRejectedValueOnce(new Error('rolled back'));
      await expect(policy.revoke('u1', 'org1')).rejects.toThrow('rolled back');
      expect(sessionCache.refreshUser).not.toHaveBeenCalled();
    });
  });
});
