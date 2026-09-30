import type { IncomingHttpHeaders } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `../auth/auth` opens a real Postgres pool at import time, so mock it before
// the gateway pulls it in. Each `auth.api.*` method is a vi.fn we can assert on.
const findMany = vi.hoisted(() => vi.fn());
const findOne = vi.hoisted(() => vi.fn());

vi.mock('../../../auth/infrastructure/better-auth.config', () => ({
  auth: {
    // Better Auth's database adapter: the session rows, never the Redis copy.
    $context: Promise.resolve({ adapter: { findMany, findOne } }),
    api: {
      listUsers: vi.fn(),
      getUser: vi.fn(),
      createUser: vi.fn(),
      adminUpdateUser: vi.fn(),
      setRole: vi.fn(),
      banUser: vi.fn(),
      unbanUser: vi.fn(),
      removeUser: vi.fn(),
      userHasPermission: vi.fn(),
      revokeUserSession: vi.fn(),
      revokeUserSessions: vi.fn(),
      setUserPassword: vi.fn(),
      impersonateUser: vi.fn(),
      stopImpersonating: vi.fn(),
    },
  },
}));

import { auth } from '../../../auth/infrastructure/better-auth.config';
import type { DelegatedSessionPort } from '../../../auth/infrastructure/delegated-session.port';
import { AdminAuthGateway } from '../admin-auth.gateway';

const api = auth.api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const headers: IncomingHttpHeaders = {
  authorization: 'Bearer token',
  cookie: 'session=abc',
};

const userRecord = {
  id: 'u1',
  email: 'a@b.com',
  name: 'Alice',
  role: 'user',
  emailVerified: true,
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('AdminAuthGateway', () => {
  let gateway: AdminAuthGateway;
  let delegatedSessions: DelegatedSessionPort;

  beforeEach(() => {
    vi.clearAllMocks();
    delegatedSessions = {
      resolveSessionToken: vi.fn(),
      invalidate: vi.fn(),
      invalidateForUser: vi.fn().mockResolvedValue(undefined),
    };
    gateway = new AdminAuthGateway(delegatedSessions);
  });

  it('lists users forwarding query params and mapping the envelope', async () => {
    api.listUsers.mockResolvedValue({
      users: [userRecord],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const result = await gateway.listUsers(headers, {
      searchValue: 'ali',
      searchField: 'email',
      limit: 20,
      offset: 0,
      sortBy: 'name',
      sortDirection: 'asc',
    });

    expect(result.total).toBe(1);
    expect(result.users[0].id).toBe('u1');
    expect(api.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          searchValue: 'ali',
          searchField: 'email',
          limit: 20,
        }),
      }),
    );
    const call = api.listUsers.mock.calls[0][0];
    expect(call.headers).toBeInstanceOf(Headers);
  });

  it('gets a user by id', async () => {
    api.getUser.mockResolvedValue(userRecord);
    const result = await gateway.getUser(headers, 'u1');
    expect(result.id).toBe('u1');
    expect(api.getUser).toHaveBeenCalledWith(expect.objectContaining({ query: { id: 'u1' } }));
  });

  it('creates a user, casting the role at the boundary', async () => {
    api.createUser.mockResolvedValue({ user: userRecord });
    const result = await gateway.createUser(headers, {
      email: 'a@b.com',
      name: 'Alice',
      password: 'secret',
      role: 'admin',
    });
    expect(result).toBe('u1');
    expect(api.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: 'a@b.com', role: 'admin' }),
      }),
    );
  });

  it('passes role undefined to createUser when none is given', async () => {
    api.createUser.mockResolvedValue(userRecord);
    await gateway.createUser(headers, {
      email: 'a@b.com',
      name: 'Alice',
      password: 'secret',
    });
    expect(api.createUser.mock.calls[0][0].body.role).toBeUndefined();
  });

  it('updates a user profile', async () => {
    api.adminUpdateUser.mockResolvedValue(userRecord);
    await gateway.updateUser(headers, 'u1', { name: 'Alice B' });
    expect(api.adminUpdateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { userId: 'u1', data: { name: 'Alice B' } },
      }),
    );
  });

  it('sets a user role', async () => {
    api.setRole.mockResolvedValue(userRecord);
    await gateway.setRole(headers, 'u1', 'admin');
    expect(api.setRole).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: 'u1', role: 'admin' } }),
    );
  });

  it('bans a user with reason and expiry', async () => {
    api.banUser.mockResolvedValue(userRecord);
    await gateway.ban(headers, 'u1', {
      banReason: 'abuse',
      banExpiresIn: 3600,
    });
    expect(api.banUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { userId: 'u1', banReason: 'abuse', banExpiresIn: 3600 },
      }),
    );
  });

  it('unbans a user', async () => {
    api.unbanUser.mockResolvedValue(userRecord);
    await gateway.unban(headers, 'u1');
    expect(api.unbanUser).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: 'u1' } }));
  });

  // The ban deletes the delegated rows; without the rotation a credential
  // keeps presenting the cached token of a deleted row after an unban.
  const banOrUnban = [
    ['ban', 'banUser', () => gateway.ban(headers, 'u1', {})],
    ['unban', 'unbanUser', () => gateway.unban(headers, 'u1')],
  ] as const;

  it.each(banOrUnban)(
    'rotates the delegated-session generation after a %s',
    async (_, method, call) => {
      api[method].mockResolvedValue(userRecord);
      await call();
      expect(delegatedSessions.invalidateForUser).toHaveBeenCalledExactlyOnceWith('u1');
    },
  );

  it.each(banOrUnban)(
    'leaves the delegated sessions alone when the %s fails',
    async (_, method, call) => {
      api[method].mockRejectedValue(new Error('upstream down'));
      await expect(call()).rejects.toBeDefined();
      expect(delegatedSessions.invalidateForUser).not.toHaveBeenCalled();
    },
  );

  it('removes a user and reports success', async () => {
    api.removeUser.mockResolvedValue({ success: true });
    const result = await gateway.remove(headers, 'u1');
    expect(result).toEqual({ success: true });
  });

  it('lists user sessions from Postgres, after the admin plugin allows it', async () => {
    // The plugin's list walks the Redis index, which never saw a session
    // signed in before the cache existed; the table has it.
    api.userHasPermission.mockResolvedValue({ success: true });
    findMany.mockResolvedValue([
      {
        id: 's1',
        userId: 'u1',
        token: 'token-1',
        expiresAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]);

    const result = await gateway.listSessions(headers, 'u1');

    expect(api.userHasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ body: { permissions: { session: ['list'] } } }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'session',
        where: expect.arrayContaining([{ field: 'userId', value: 'u1' }]),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
    expect(result[0]).not.toHaveProperty('token');
  });

  it('reads every page, so no live session is past the end of the list', async () => {
    api.userHasPermission.mockResolvedValue({ success: true });
    const page = (from: number, size: number) =>
      Array.from({ length: size }, (_, i) => ({ id: `s${from + i}`, userId: 'u1' }));
    findMany.mockReset();
    findMany.mockResolvedValueOnce(page(0, 500)).mockResolvedValueOnce(page(500, 3));

    const result = await gateway.listSessions(headers, 'u1');

    expect(result).toHaveLength(503);
    expect(findMany.mock.calls.map((call) => call[0].offset)).toEqual([0, 500]);
  });

  it('reads no rows when the admin plugin refuses', async () => {
    api.userHasPermission.mockResolvedValue({ success: false });
    findMany.mockClear();

    await expect(gateway.listSessions(headers, 'u1')).rejects.toMatchObject({
      code: 'ADMIN_003',
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('revokes a session named by id with the token it resolves to', async () => {
    api.userHasPermission.mockResolvedValue({ success: true });
    findOne.mockResolvedValue({ id: 's2', userId: 'u1', token: 'token-2' });
    api.revokeUserSession.mockResolvedValue({ success: true });

    const result = await gateway.revokeSessionById(headers, 'u1', 's2');

    expect(result).toEqual({ success: true });
    expect(api.userHasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ body: { permissions: { session: ['revoke'] } } }),
    );
    // Found by id *and* owner, so another user's session id finds nothing.
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          { field: 'id', value: 's2' },
          { field: 'userId', value: 'u1' },
        ]),
      }),
    );
    // The client passed a session id; the raw token never left the gateway.
    expect(api.revokeUserSession).toHaveBeenCalledWith(
      expect.objectContaining({ body: { sessionToken: 'token-2' } }),
    );
  });

  it('answers SESSION_NOT_FOUND for an id the user does not hold', async () => {
    api.userHasPermission.mockResolvedValue({ success: true });
    findOne.mockResolvedValue(null);

    await expect(gateway.revokeSessionById(headers, 'u1', 'missing')).rejects.toMatchObject({
      code: 'ADMIN_009',
    });
    expect(api.revokeUserSession).not.toHaveBeenCalled();
  });

  it('revokes all sessions', async () => {
    api.revokeUserSessions.mockResolvedValue({ status: true });
    const result = await gateway.revokeAllSessions(headers, 'u1');
    expect(result).toEqual({ success: true });
  });

  it('sets a password', async () => {
    api.setUserPassword.mockResolvedValue({ status: true });
    const result = await gateway.setPassword(headers, 'u1', 'new-password');
    expect(result).toEqual({ success: true });
    expect(api.setUserPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { userId: 'u1', newPassword: 'new-password' },
      }),
    );
  });

  describe('impersonation (returns the Set-Cookie values to forward)', () => {
    it('impersonate returns the cookies Better Auth set', async () => {
      const outHeaders = new Headers({ 'set-cookie': 'session=impersonated' });
      api.impersonateUser.mockResolvedValue({
        response: { user: userRecord },
        headers: outHeaders,
      });

      const result = await gateway.impersonate(headers, 'u1');

      expect(result).toEqual(['session=impersonated']);
      expect(api.impersonateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { userId: 'u1' },
          returnHeaders: true,
        }),
      );
    });

    it('stopImpersonating returns the restored user and its cookies', async () => {
      const outHeaders = new Headers({ 'set-cookie': 'session=admin' });
      api.stopImpersonating.mockResolvedValue({
        response: { user: userRecord },
        headers: outHeaders,
      });

      const result = await gateway.stopImpersonating(headers);

      expect(result.user.id).toBe('u1');
      expect(result.cookies).toEqual(['session=admin']);
      expect(api.stopImpersonating).toHaveBeenCalledWith(
        expect.objectContaining({ returnHeaders: true }),
      );
    });
  });
});
