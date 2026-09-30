import { canAccessRow } from '@oppenheimer/backend-authz';
import type { CacheService } from '@oppenheimer/backend-cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AuthzVersionRepositoryPort,
  AuthzVersions,
} from '../../database/authz-version.repository.port';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../database/user-role.repository.port';
import { RoleEntity } from '../../domain/role.entity';
import { Permission } from '../../domain/value-objects/permission.value-object';
import { AbilityFactory } from '../ability.factory';
import { GlobalRoleRegistry } from '../global-role.registry';

function makeRole(
  name: string,
  permissions: Permission[],
  isSystem = false,
  organizationId: string | null = null,
): RoleEntity {
  return RoleEntity.create({
    id: `role-${name}`,
    props: {
      name,
      description: null,
      isSystem,
      organizationId,
      permissions,
    },
  });
}

const manageAll = () => [Permission.fromDefinition({ action: 'manage', subject: 'all' })];

/** An in-memory `CacheService` whose calls can be asserted and made to fail. */
function memoryCache() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      // Round-trip through JSON, as Redis does.
      store.set(key, JSON.parse(JSON.stringify(value)));
    }),
    del: vi.fn(),
    reset: vi.fn(),
    setIfAbsent: vi.fn(),
    take: vi.fn(),
  };
}

describe('AbilityFactory', () => {
  let factory: AbilityFactory;
  let userRoleRepo: UserRoleRepositoryPort;
  let roleRepo: Pick<RoleRepositoryPort, 'findGlobal' | 'findOneByName'>;
  let versions: { read: ReturnType<typeof vi.fn> };
  let current: AuthzVersions;
  let cache: ReturnType<typeof memoryCache>;

  const build = () =>
    new AbilityFactory(
      userRoleRepo,
      versions as unknown as AuthzVersionRepositoryPort,
      new GlobalRoleRegistry(roleRepo as RoleRepositoryPort),
      cache as unknown as CacheService,
    );

  beforeEach(() => {
    userRoleRepo = {
      findRoleIdsForUser: vi.fn(),
      findRolesForUser: vi.fn().mockResolvedValue([]),
      setRolesForUser: vi.fn(),
      assignRoleToUser: vi.fn(),
      replaceMembershipRole: vi.fn(),
    };
    roleRepo = { findGlobal: vi.fn().mockResolvedValue([]), findOneByName: vi.fn() };
    current = { organization: '1', catalog: '1', user: '0' };
    versions = { read: vi.fn(async () => ({ ...current })) };
    cache = memoryCache();
    factory = build();
  });

  it('builds the ability from the union of the user’s assigned roles', async () => {
    vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([
      makeRole('reader', [Permission.fromDefinition({ action: 'read', subject: 'User' })]),
      makeRole('writer', [Permission.fromDefinition({ action: 'create', subject: 'Article' })]),
    ]);

    const ability = await factory.createForUser({ id: 'user-1' });

    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('create', 'Article')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(false);
  });

  describe('forRequest', () => {
    /** A request `ApiAuthGuard` stamped with its tenant. */
    const requestIn = (organizationId: string | null) => ({
      user: { id: 'user-1' },
      session: { activeTeamId: null },
      tenant: { organizationId },
    });

    it("builds the ability in the request's tenant", async () => {
      await factory.forRequest(requestIn('org-b'));

      expect(versions.read).toHaveBeenCalledWith('user-1', 'org-b');
      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledWith('user-1', 'org-b');
    });

    it('resolves the organization placeholder to the tenant', async () => {
      vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([
        makeRole('owner', [
          Permission.fromDefinition({
            action: 'read',
            subject: 'Member',
            // biome-ignore lint/suspicious/noTemplateCurlyInString: a stored condition placeholder
            conditions: { organizationId: '${activeOrganizationId}' },
          }),
        ]),
      ]);

      const ability = await factory.forRequest(requestIn('org-b'));

      expect(canAccessRow(ability, 'read', 'Member', { organizationId: 'org-b' })).toBe(true);
      expect(canAccessRow(ability, 'read', 'Member', { organizationId: 'org-a' })).toBe(false);
    });

    it('acts in no organization on a request no guard stamped: only global roles count', async () => {
      await factory.forRequest({ user: { id: 'user-1' } });

      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledWith('user-1', null);
    });

    it('builds the ability once per request and serves every later caller the same one', async () => {
      const request = requestIn('org-b');

      const first = await factory.forRequest(request);
      const second = await factory.forRequest(request);

      expect(second).toBe(first);
      expect(request).toMatchObject({ ability: first });
      expect(versions.read).toHaveBeenCalledTimes(1);
      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledTimes(1);
    });

    it('shares one resolution between concurrent callers and the role ids', async () => {
      vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([
        makeRole('reader', [Permission.fromDefinition({ action: 'read', subject: 'User' })]),
      ]);
      const request = requestIn('org-b');

      const [ability, roleIds, again] = await Promise.all([
        factory.forRequest(request),
        factory.roleIdsForRequest(request),
        factory.forRequest(request),
      ]);

      expect(again).toBe(ability);
      expect(roleIds).toEqual(['role-reader']);
      expect(versions.read).toHaveBeenCalledTimes(1);
      expect(cache.get).toHaveBeenCalledTimes(1);
      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledTimes(1);
    });

    it('takes no organization argument: the tenant on the request is the only input', () => {
      // An argument the memo cannot see is how one organization's ability was
      // served for another. The tenant is write-once (see the
      // RequestTenantResolver spec), so the plain per-request memo is safe.
      expect(factory.forRequest.length).toBe(1);
    });
  });

  describe('the role cache', () => {
    beforeEach(() => {
      vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([
        makeRole('reader', [Permission.fromDefinition({ action: 'read', subject: 'User' })]),
      ]);
    });

    it('serves a warm hit without reading the role tables', async () => {
      const first = await factory.permissionsForUser({ id: 'user-1' }, { organizationId: 'org-1' });
      vi.mocked(userRoleRepo.findRolesForUser).mockClear();

      const second = await factory.permissionsForUser(
        { id: 'user-1' },
        { organizationId: 'org-1' },
      );

      expect(second).toEqual(first);
      expect(second).toEqual([{ action: 'read', subject: 'User' }]);
      expect(userRoleRepo.findRolesForUser).not.toHaveBeenCalled();
      expect(roleRepo.findOneByName).not.toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith(
        'authz:roles:v1:user-1:org-1:1:1:0',
        { roleIds: ['role-reader'], permissions: [{ action: 'read', subject: 'User' }] },
        900,
      );
    });

    it.each([
      ['organization', { organization: '2' }],
      ['catalog', { catalog: '2' }],
      ['user', { user: '1' }],
    ] as const)('misses once the %s version moves', async (_name, bump) => {
      await factory.createForUser({ id: 'user-1' }, { organizationId: 'org-1' });
      Object.assign(current, bump);

      await factory.createForUser({ id: 'user-1' }, { organizationId: 'org-1' });

      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledTimes(2);
      expect(new Set(cache.set.mock.calls.map(([key]) => key)).size).toBe(2);
    });

    it('keys each organization apart, and a request in none apart from both', async () => {
      await factory.createForUser({ id: 'user-1' }, { organizationId: 'org-1' });
      await factory.createForUser({ id: 'user-1' }, { organizationId: 'org-2' });
      await factory.createForUser({ id: 'user-1' });

      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledTimes(3);
    });

    it('reads the versions before the cache, and the cache before computing', async () => {
      const order: string[] = [];
      versions.read.mockImplementation(async () => {
        order.push('versions');
        return { ...current };
      });
      cache.get.mockImplementation(async () => {
        order.push('cache.get');
        return undefined;
      });
      vi.mocked(userRoleRepo.findRolesForUser).mockImplementation(async () => {
        order.push('compute');
        return [];
      });
      cache.set.mockImplementation(async () => {
        order.push('cache.set');
      });

      await factory.createForUser({ id: 'user-1' }, { organizationId: 'org-1' });

      expect(order).toEqual(['versions', 'cache.get', 'compute', 'cache.set']);
    });

    it('falls back to the database when the cache throws, and warns once', async () => {
      cache.get.mockRejectedValue(new Error('ECONNREFUSED'));
      cache.set.mockRejectedValue(new Error('ECONNREFUSED'));
      const warn = vi
        .spyOn(
          (factory as unknown as { logger: { warn: (...args: unknown[]) => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const first = await factory.createForUser({ id: 'user-1' }, { organizationId: 'org-1' });
      const second = await factory.createForUser({ id: 'user-1' }, { organizationId: 'org-1' });

      expect(first.can('read', 'User')).toBe(true);
      expect(second.can('read', 'User')).toBe(true);
      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toEqual({ message: expect.stringContaining('authz cache') });
    });

    it('does not read the join for a principal with no id', async () => {
      await factory.createForUser({ role: 'user' });

      expect(versions.read).toHaveBeenCalledWith(null, null);
      expect(cache.get).not.toHaveBeenCalled();
      expect(userRoleRepo.findRolesForUser).not.toHaveBeenCalled();
    });
  });

  describe('platform roles (`user.role`)', () => {
    it('falls back to the legacy role name via the global role when no assignments exist', async () => {
      vi.mocked(roleRepo.findGlobal).mockResolvedValue([makeRole('admin', manageAll(), true)]);

      const ability = await factory.createForUser({ id: 'user-1', role: 'admin' });

      expect(ability.can('delete', 'Role')).toBe(true);
    });

    it('unions the Better Auth `user.role` column with the assigned join roles', async () => {
      // Simulates an admin-plugin `set-role` promotion: the user keeps their
      // default `user` join row but `user.role` is now `admin`, so CASL must also
      // grant the `admin` role's permissions.
      vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([
        makeRole('user', [Permission.fromDefinition({ action: 'read', subject: 'User' })]),
      ]);
      vi.mocked(roleRepo.findGlobal).mockResolvedValue([makeRole('admin', manageAll(), true)]);

      const ability = await factory.createForUser({ id: 'user-1', role: 'admin' });

      expect(ability.can('read', 'User')).toBe(true); // from the join role
      expect(ability.can('delete', 'Role')).toBe(true); // from user.role = admin
    });

    it('unions comma-separated Better Auth platform roles', async () => {
      vi.mocked(roleRepo.findGlobal).mockResolvedValue([makeRole('admin', manageAll(), true)]);

      const ability = await factory.createForUser({ id: 'user-1', role: 'user, admin' });

      expect(ability.can('delete', 'Role')).toBe(true);
    });

    it('resolves a platform role from the global rows only, never a tenant role of that name', async () => {
      // A tenant's `admin` would answer a lookup by name alone. The registry is
      // loaded from the global rows and nothing else — no lookup by name at
      // all — so a tenant role never stands in for the platform's.
      vi.mocked(roleRepo.findGlobal).mockResolvedValue([makeRole('admin', manageAll(), true)]);

      const ability = await factory.createForUser(
        { id: 'user-1', role: 'admin' },
        { organizationId: 'org-1' },
      );

      expect(roleRepo.findOneByName).not.toHaveBeenCalled();
      expect(roleRepo.findGlobal).toHaveBeenCalledTimes(1);
      expect(ability.can('manage', 'all')).toBe(true);
    });

    it('issues no query for a platform role while the snapshot is current', async () => {
      await factory.createForUser({ id: 'user-1', role: 'user' });
      await factory.createForUser({ id: 'user-1', role: 'admin' });
      await factory.createForUser({ id: 'user-2', role: 'user' });

      expect(roleRepo.findGlobal).toHaveBeenCalledTimes(1);
    });

    it('reloads the snapshot once when the catalog version moves, shared by concurrent callers', async () => {
      vi.mocked(roleRepo.findGlobal).mockResolvedValue([makeRole('admin', [], true)]);
      const before = await factory.createForUser({ id: 'user-1', role: 'admin' });
      expect(before.can('manage', 'all')).toBe(false);

      vi.mocked(roleRepo.findGlobal).mockResolvedValue([makeRole('admin', manageAll(), true)]);
      current.catalog = '2';
      const [first, second] = await Promise.all([
        factory.createForUser({ id: 'user-1', role: 'admin' }),
        factory.createForUser({ id: 'user-2', role: 'admin' }),
      ]);

      expect(roleRepo.findGlobal).toHaveBeenCalledTimes(2);
      expect(first.can('manage', 'all')).toBe(true);
      expect(second.can('manage', 'all')).toBe(true);
    });

    it('falls back to the seeded system-role permissions when the role is not in the DB', async () => {
      const ability = await factory.createForUser({ id: 'user-1', role: 'user' });

      // The seeded `user` set grants its own API tokens and nothing else, so
      // that rule is what proves the fallback was taken rather than an empty
      // ability being returned.
      expect(ability.can('read', 'ApiToken')).toBe(true);
      expect(ability.can('read', 'User')).toBe(false);
      expect(ability.can('delete', 'User')).toBe(false);
      expect(ability.can('manage', 'all')).toBe(false);
    });

    it('does not remember a failed snapshot load: the next call retries', async () => {
      vi.mocked(roleRepo.findGlobal)
        .mockRejectedValueOnce(new Error('connection reset'))
        .mockResolvedValueOnce([makeRole('admin', manageAll(), true)]);

      await expect(factory.createForUser({ id: 'user-1', role: 'admin' })).rejects.toThrow(
        'connection reset',
      );
      const ability = await factory.createForUser({ id: 'user-1', role: 'admin' });

      expect(ability.can('manage', 'all')).toBe(true);
    });
  });

  it('serves a second replica the same change on its next call', async () => {
    // Two factories, two snapshots: a global role edit bumps the catalog in the
    // database, and each process sees the new version on its own next read.
    vi.mocked(roleRepo.findGlobal).mockResolvedValue([makeRole('admin', [], true)]);
    const replica = build();
    await factory.createForUser({ id: 'user-1', role: 'admin' });
    await replica.createForUser({ id: 'user-1', role: 'admin' });

    vi.mocked(roleRepo.findGlobal).mockResolvedValue([makeRole('admin', manageAll(), true)]);
    current.catalog = '2';

    expect(
      (await replica.createForUser({ id: 'user-1', role: 'admin' })).can('manage', 'all'),
    ).toBe(true);
    expect(
      (await factory.createForUser({ id: 'user-1', role: 'admin' })).can('manage', 'all'),
    ).toBe(true);
  });
});
