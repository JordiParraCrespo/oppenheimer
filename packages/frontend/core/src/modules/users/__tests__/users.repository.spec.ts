import type { Role } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../core/errors';
import { UserEntity } from '../user.entity';

const api = vi.hoisted(() => ({
  getMe: vi.fn(),
  getMyPermissions: vi.fn(),
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

  it('is a getter, so it does not survive the persisted query cache', () => {
    const rehydrated = JSON.parse(JSON.stringify(user()));

    expect(rehydrated.fullName).toBeUndefined();
    expect(rehydrated.firstName).toBe('Ada');
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
});

describe('UsersRepository', () => {
  let repository: InstanceType<typeof UsersRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UsersRepository();
  });

  describe('me', () => {
    it('maps the signed-in user', async () => {
      api.getMe.mockResolvedValue(ok(dto()));

      expect((await repository.me()).email).toBe('ada@example.com');
    });
  });

  describe('myPermissions', () => {
    it('returns the raw CASL rules, not an entity', async () => {
      api.getMyPermissions.mockResolvedValue(
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
      api.getMyPermissions.mockResolvedValue(ok({ permissions: [] }));

      await expect(repository.myPermissions()).resolves.toEqual([]);
    });

    it('fails on an absent body rather than granting nothing silently', async () => {
      api.getMyPermissions.mockResolvedValue(ok(undefined));

      await expect(repository.myPermissions()).rejects.toBeInstanceOf(AppError);
    });
  });
});
