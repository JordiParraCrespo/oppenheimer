import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The controller imports AdminService, which imports `../auth/auth` (a real pg
// pool at import time) — mock it so the module graph loads without a database.
vi.mock('../../auth/auth', () => ({ auth: { api: {} } }));

import { AdminController } from '../admin.controller';
import type { AdminService } from '../admin.service';
import type { AdminUserResponseDto } from '../dtos/admin-user.response.dto';

const user: AdminUserResponseDto = {
  id: 'u1',
  email: 'a@b.com',
  name: 'Alice',
  role: 'user',
  emailVerified: true,
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

function makeRes(): Response & { setHeader: ReturnType<typeof vi.fn> } {
  return { setHeader: vi.fn() } as unknown as Response & {
    setHeader: ReturnType<typeof vi.fn>;
  };
}

const req = { headers: { cookie: 'session=abc' } } as unknown as Request;

describe('AdminController', () => {
  let service: {
    [K in keyof AdminService]: ReturnType<typeof vi.fn>;
  };
  let controller: AdminController;

  beforeEach(() => {
    service = {
      listUsers: vi.fn(),
      getUser: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      setRole: vi.fn(),
      ban: vi.fn(),
      unban: vi.fn(),
      remove: vi.fn(),
      listSessions: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllSessions: vi.fn(),
      setPassword: vi.fn(),
      impersonate: vi.fn(),
      stopImpersonating: vi.fn(),
    } as unknown as typeof service;
    controller = new AdminController(service as unknown as AdminService);
  });

  it('delegates listUsers, converting numeric query strings', async () => {
    service.listUsers.mockResolvedValue({
      users: [],
      total: 0,
      limit: null,
      offset: null,
    });
    await controller.listUsers(req, 'ali', 'email', '20', '5', 'name', 'asc');
    expect(service.listUsers).toHaveBeenCalledWith(req.headers, {
      searchValue: 'ali',
      searchField: 'email',
      limit: 20,
      offset: 5,
      sortBy: 'name',
      sortDirection: 'asc',
    });
  });

  it('passes undefined limit/offset when the query params are absent', async () => {
    service.listUsers.mockResolvedValue({
      users: [],
      total: 0,
      limit: null,
      offset: null,
    });
    await controller.listUsers(req);
    const arg = service.listUsers.mock.calls[0][1];
    expect(arg.limit).toBeUndefined();
    expect(arg.offset).toBeUndefined();
  });

  describe('impersonate', () => {
    it('forwards Better Auth Set-Cookie headers to the response', async () => {
      const headers = new Headers();
      headers.append('set-cookie', 'session=impersonated; Path=/');
      service.impersonate.mockResolvedValue({ user, headers });
      const res = makeRes();

      const result = await controller.impersonate(req, res, 'u1');

      expect(result).toBe(user);
      expect(service.impersonate).toHaveBeenCalledWith(req.headers, 'u1');
      expect(res.setHeader).toHaveBeenCalledWith('set-cookie', ['session=impersonated; Path=/']);
    });

    it('does not set a cookie header when Better Auth returns none', async () => {
      service.impersonate.mockResolvedValue({ user, headers: new Headers() });
      const res = makeRes();

      await controller.impersonate(req, res, 'u1');

      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('stopImpersonating', () => {
    it('forwards restored-session cookies to the response', async () => {
      const headers = new Headers();
      headers.append('set-cookie', 'session=admin; Path=/');
      service.stopImpersonating.mockResolvedValue({ user, headers });
      const res = makeRes();

      const result = await controller.stopImpersonating(req, res);

      expect(result).toBe(user);
      expect(res.setHeader).toHaveBeenCalledWith('set-cookie', ['session=admin; Path=/']);
    });
  });

  it('delegates setRole to the service', async () => {
    service.setRole.mockResolvedValue(user);
    await controller.setRole(req, 'u1', { role: 'admin' });
    expect(service.setRole).toHaveBeenCalledWith(req.headers, 'u1', 'admin');
  });

  it('delegates ban to the service with the request body', async () => {
    service.ban.mockResolvedValue(user);
    await controller.ban(req, 'u1', { banReason: 'abuse', banExpiresIn: 3600 });
    expect(service.ban).toHaveBeenCalledWith(req.headers, 'u1', {
      banReason: 'abuse',
      banExpiresIn: 3600,
    });
  });

  it('delegates set-password to the service', async () => {
    service.setPassword.mockResolvedValue({ success: true });
    await controller.setPassword(req, 'u1', { newPassword: 'new-secret' });
    expect(service.setPassword).toHaveBeenCalledWith(req.headers, 'u1', 'new-secret');
  });
});
