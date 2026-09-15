import type { IncomingHttpHeaders } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `../auth/auth` opens a real Postgres pool at import time, so mock it before
// the service pulls it in. Each `auth.api.*` method is a vi.fn we can assert on.
vi.mock('../../auth/auth', () => ({
  auth: {
    api: {
      listUsers: vi.fn(),
      getUser: vi.fn(),
      createUser: vi.fn(),
      adminUpdateUser: vi.fn(),
      setRole: vi.fn(),
      banUser: vi.fn(),
      unbanUser: vi.fn(),
      removeUser: vi.fn(),
      listUserSessions: vi.fn(),
      revokeUserSession: vi.fn(),
      revokeUserSessions: vi.fn(),
      setUserPassword: vi.fn(),
      impersonateUser: vi.fn(),
      stopImpersonating: vi.fn(),
    },
  },
}));

import { auth } from '../../auth/auth';
import { AdminService } from '../admin.service';

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

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService();
  });

  it('lists users forwarding query params and mapping the envelope', async () => {
    api.listUsers.mockResolvedValue({
      users: [userRecord],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const result = await service.listUsers(headers, {
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
    // headers were converted to a Headers object for Better Auth
    const call = api.listUsers.mock.calls[0][0];
    expect(call.headers).toBeInstanceOf(Headers);
  });

  it('gets a user by id', async () => {
    api.getUser.mockResolvedValue(userRecord);
    const result = await service.getUser(headers, 'u1');
    expect(result.id).toBe('u1');
    expect(api.getUser).toHaveBeenCalledWith(expect.objectContaining({ query: { id: 'u1' } }));
  });

  it('creates a user, casting the role at the boundary', async () => {
    api.createUser.mockResolvedValue({ user: userRecord });
    const result = await service.createUser(headers, {
      email: 'a@b.com',
      name: 'Alice',
      password: 'secret',
      role: 'admin',
    });
    expect(result.id).toBe('u1');
    expect(api.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: 'a@b.com', role: 'admin' }),
      }),
    );
  });

  it('passes role undefined to createUser when none is given', async () => {
    api.createUser.mockResolvedValue(userRecord);
    await service.createUser(headers, {
      email: 'a@b.com',
      name: 'Alice',
      password: 'secret',
    });
    expect(api.createUser.mock.calls[0][0].body.role).toBeUndefined();
  });

  it('updates a user profile', async () => {
    api.adminUpdateUser.mockResolvedValue(userRecord);
    await service.updateUser(headers, 'u1', { name: 'Alice B' });
    expect(api.adminUpdateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { userId: 'u1', data: { name: 'Alice B' } },
      }),
    );
  });

  it('sets a user role', async () => {
    api.setRole.mockResolvedValue(userRecord);
    await service.setRole(headers, 'u1', 'admin');
    expect(api.setRole).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: 'u1', role: 'admin' } }),
    );
  });

  it('bans a user with reason and expiry', async () => {
    api.banUser.mockResolvedValue(userRecord);
    await service.ban(headers, 'u1', {
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
    await service.unban(headers, 'u1');
    expect(api.unbanUser).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: 'u1' } }));
  });

  it('removes a user and reports success', async () => {
    api.removeUser.mockResolvedValue({ success: true });
    const result = await service.remove(headers, 'u1');
    expect(result).toEqual({ success: true });
  });

  it('lists user sessions', async () => {
    api.listUserSessions.mockResolvedValue({
      sessions: [
        {
          id: 's1',
          userId: 'u1',
          expiresAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    const result = await service.listSessions(headers, 'u1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('revokes a single session by id, resolving its token server-side', async () => {
    api.listUserSessions.mockResolvedValue({
      sessions: [
        { id: 's1', userId: 'u1', token: 'token-1' },
        { id: 's2', userId: 'u1', token: 'token-2' },
      ],
    });
    api.revokeUserSession.mockResolvedValue({ success: true });

    const result = await service.revokeSession(headers, 'u1', 's2');

    expect(result).toEqual({ success: true });
    expect(api.listUserSessions).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: 'u1' } }),
    );
    // The client passed a session id; the raw token never left the API.
    expect(api.revokeUserSession).toHaveBeenCalledWith(
      expect.objectContaining({ body: { sessionToken: 'token-2' } }),
    );
  });

  it('throws SESSION_NOT_FOUND when the session id does not belong to the user', async () => {
    api.listUserSessions.mockResolvedValue({
      sessions: [{ id: 's1', userId: 'u1', token: 'token-1' }],
    });

    await expect(service.revokeSession(headers, 'u1', 'missing')).rejects.toMatchObject({
      code: 'ADMIN_009',
    });
    expect(api.revokeUserSession).not.toHaveBeenCalled();
  });

  it('revokes all sessions', async () => {
    api.revokeUserSessions.mockResolvedValue({ status: true });
    const result = await service.revokeAllSessions(headers, 'u1');
    expect(result).toEqual({ success: true });
  });

  it('sets a password', async () => {
    api.setUserPassword.mockResolvedValue({ status: true });
    const result = await service.setPassword(headers, 'u1', 'new-password');
    expect(result).toEqual({ success: true });
    expect(api.setUserPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { userId: 'u1', newPassword: 'new-password' },
      }),
    );
  });

  describe('impersonation (returns Set-Cookie headers to forward)', () => {
    it('impersonate returns the mapped user and Better Auth headers', async () => {
      const outHeaders = new Headers({ 'set-cookie': 'session=impersonated' });
      api.impersonateUser.mockResolvedValue({
        response: { user: userRecord },
        headers: outHeaders,
      });

      const result = await service.impersonate(headers, 'u1');

      expect(result.user.id).toBe('u1');
      expect(result.headers).toBe(outHeaders);
      expect(api.impersonateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { userId: 'u1' },
          returnHeaders: true,
        }),
      );
    });

    it('stopImpersonating returns the restored user and headers', async () => {
      const outHeaders = new Headers({ 'set-cookie': 'session=admin' });
      api.stopImpersonating.mockResolvedValue({
        response: { user: userRecord },
        headers: outHeaders,
      });

      const result = await service.stopImpersonating(headers);

      expect(result.user.id).toBe('u1');
      expect(result.headers).toBe(outHeaders);
      expect(api.stopImpersonating).toHaveBeenCalledWith(
        expect.objectContaining({ returnHeaders: true }),
      );
    });
  });
});
