import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DelegatedSessionAdapter } from '../../auth/infrastructure/delegated-session.adapter';
import { ProfileAuthGateway } from '../infrastructure/profile-auth.gateway';

// `auth.api.*` reaches a real Better Auth instance (and its database pool) at
// module load, so the calls are stubbed; what is under test here is which
// caches the façade evicts, not what Better Auth does.
const changePassword = vi.fn();
const revokeSession = vi.fn();
const revokeOtherSessions = vi.fn();

vi.mock('../../auth/infrastructure/better-auth.config', () => ({
  auth: {
    api: {
      changePassword: (...args: unknown[]) => changePassword(...args),
      revokeSession: (...args: unknown[]) => revokeSession(...args),
      revokeOtherSessions: (...args: unknown[]) => revokeOtherSessions(...args),
    },
  },
}));

describe('ProfileAuthGateway', () => {
  let delegatedSessions: { invalidateForUser: ReturnType<typeof vi.fn> };
  let facade: ProfileAuthGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    delegatedSessions = {
      invalidateForUser: vi.fn().mockResolvedValue(undefined),
    };
    facade = new ProfileAuthGateway(delegatedSessions as unknown as DelegatedSessionAdapter);
  });

  describe('changePassword', () => {
    it('evicts the caller’s delegated sessions when it revoked the others', async () => {
      // Better Auth deletes the delegated session rows along with the rest; a
      // credential still holding the cached token would fail every façade call
      // for the next ten minutes.
      await facade.changePassword(
        {},
        {
          userId: 'user-1',
          currentPassword: 'old',
          newPassword: 'new',
          revokeOtherSessions: true,
        },
      );

      expect(delegatedSessions.invalidateForUser).toHaveBeenCalledWith('user-1');
    });

    it('evicts nothing when the other sessions were kept', async () => {
      await facade.changePassword(
        {},
        {
          userId: 'user-1',
          currentPassword: 'old',
          newPassword: 'new',
          revokeOtherSessions: false,
        },
      );

      expect(delegatedSessions.invalidateForUser).not.toHaveBeenCalled();
    });

    it('does not evict when the password change failed', async () => {
      changePassword.mockRejectedValueOnce(new Error('wrong password'));

      await expect(
        facade.changePassword(
          {},
          {
            userId: 'user-1',
            currentPassword: 'wrong',
            newPassword: 'new',
            revokeOtherSessions: true,
          },
        ),
      ).rejects.toBeDefined();

      expect(delegatedSessions.invalidateForUser).not.toHaveBeenCalled();
    });
  });

  describe('revokeOtherSessions', () => {
    it('evicts the caller’s delegated sessions', async () => {
      await facade.revokeOtherSessions({}, 'user-1');

      expect(delegatedSessions.invalidateForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('revokeSession', () => {
    it('evicts nothing', async () => {
      // One revocation names a device session. A delegated session is minted
      // per credential and is not something the user chose to sign out.
      await facade.revokeSession({}, 'session-token');

      expect(delegatedSessions.invalidateForUser).not.toHaveBeenCalled();
    });
  });
});
