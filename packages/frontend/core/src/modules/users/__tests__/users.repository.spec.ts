import type { Role } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../core/errors';
import { UserEntity } from '../user.entity';

const api = vi.hoisted(() => ({
  findUsers: vi.fn(),
  me: vi.fn(),
  findMyPermissions: vi.fn(),
  findUser: vi.fn(),
  patchUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('@oppenheimer/api-client', () => ({ heyApiSdk: api }));

/** A generated SDK call's result: the body, and no error. */
function ok(data: unknown) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

const { UsersRepository } = await import('../users.repository');

function dto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'user',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('UserEntity', () => {
  function user(overrides: { firstName?: string; lastName?: string; role?: Role } = {}) {
    return new UserEntity(
      'user-1',
      'ada@example.com',
      overrides.firstName ?? 'Ada',
      overrides.lastName ?? 'Lovelace',
      overrides.role ?? ('user' as Role),
      true,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-02-01T00:00:00.000Z'),
    );
  }

  it('joins the name parts', () => {
    expect(user().fullName).toBe('Ada Lovelace');
  });

  it('is only admin for the admin role', () => {
    expect(user({ role: 'admin' as Role }).isAdmin).toBe(true);
    expect(user({ role: 'user' as Role }).isAdmin).toBe(false);
  });

  it('does not treat superadmin as admin', () => {
    // The two are distinct system roles, and this getter is read to decide what
    // the UI offers. Widening it here would silently change that surface.
    expect(user({ role: 'superadmin' as Role }).isAdmin).toBe(false);
  });

  it('recognizes control-plane roles in Better Auth comma-separated role lists', () => {
    const administrator = user({ role: 'user, admin' as Role });
    const superAdministrator = user({ role: 'user,superadmin' as Role });

    expect(administrator.isAdmin).toBe(true);
    expect(administrator.canAccessControlPlane).toBe(true);
    expect(superAdministrator.isSuperAdmin).toBe(true);
    expect(superAdministrator.canAccessControlPlane).toBe(true);
  });

  it('is a getter, so it does not survive the persisted query cache', () => {
    // Documented rather than fixed: the cache is rehydrated from JSON, where a
    // getter is gone. `apps/web`'s `personName` exists because of exactly this,
    // and reads the plain fields instead.
    const rehydrated = JSON.parse(JSON.stringify(user()));

    expect(rehydrated.fullName).toBeUndefined();
    expect(rehydrated.firstName).toBe('Ada');
  });
});

describe('UsersRepository', () => {
  let repository: InstanceType<typeof UsersRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UsersRepository();
  });

  describe('findAll', () => {
    it('maps the page into entities and keeps the metadata', async () => {
      api.findUsers.mockResolvedValue(
        ok({
          data: [dto()],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      );

      const page = await repository.findAll();

      expect(page.data[0]).toBeInstanceOf(UserEntity);
      expect(page.data[0].createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(page.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('passes the query by name', async () => {
      // The repository takes them as `(page, limit, search, role)`; a
      // transposition here would filter by the wrong field rather than fail.
      api.findUsers.mockResolvedValue(ok({ data: [], meta: {} }));

      await repository.findAll(2, 50, 'ada', 'admin' as Role);

      expect(api.findUsers).toHaveBeenCalledWith({
        query: { search: 'ada', role: 'admin', limit: 50, page: 2 },
      });
    });

    it('treats an absent body as a failed read, not an empty page', async () => {
      api.findUsers.mockResolvedValue(ok(undefined));

      const error = await repository.findAll().catch((thrown: AppError) => thrown);

      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('me', () => {
    it('maps the signed-in user', async () => {
      api.me.mockResolvedValue(ok(dto()));

      expect((await repository.me()).email).toBe('ada@example.com');
    });

    it('fails on an absent body', async () => {
      api.me.mockResolvedValue(ok(undefined));

      await expect(repository.me()).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('myPermissions', () => {
    it('returns the raw CASL rules, not an entity', async () => {
      // The app rebuilds an ability from these with
      // `defineAbilitiesFromPermissions`, so they have to arrive unshaped.
      api.findMyPermissions.mockResolvedValue(
        ok({
          permissions: [{ action: 'read', subject: 'Project' }],
        }),
      );

      await expect(repository.myPermissions()).resolves.toEqual([
        { action: 'read', subject: 'Project' },
      ]);
    });

    it('returns an empty rule set as itself', async () => {
      // A user with no permissions is a real state — the sidebar shows nothing
      // rather than everything — so `[]` must not be read as a failure.
      api.findMyPermissions.mockResolvedValue(ok({ permissions: [] }));

      await expect(repository.myPermissions()).resolves.toEqual([]);
    });

    it('fails on an absent body rather than granting nothing silently', async () => {
      api.findMyPermissions.mockResolvedValue(ok(undefined));

      await expect(repository.myPermissions()).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('findById', () => {
    it('maps the user', async () => {
      api.findUser.mockResolvedValue(ok(dto({ id: 'user-9' })));

      expect((await repository.findById('user-9')).id).toBe('user-9');
    });

    it('fails on an absent body', async () => {
      api.findUser.mockResolvedValue(ok(undefined));

      await expect(repository.findById('user-9')).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('update', () => {
    it('maps the saved user back', async () => {
      api.patchUser.mockResolvedValue(ok(dto({ firstName: 'Grace' })));

      const saved = await repository.update('user-1', { firstName: 'Grace' });

      expect(saved.firstName).toBe('Grace');
      expect(api.patchUser).toHaveBeenCalledWith({
        path: { id: 'user-1' },
        body: { firstName: 'Grace' },
      });
    });
  });
});
